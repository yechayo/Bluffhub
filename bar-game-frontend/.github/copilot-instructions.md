## Copilot 协作指令（bigrich）

本仓库包含两个彼此独立的 Vite+React+TS 前端：`bar-game-frontend`（主游戏 + 房间 + 实时通信）与 `login-frontend`（iframe 登录微前端，通过 `postMessage` 回传 token）。**不要跨目录互相导入源码或共享状态**，仅通过浏览器通信与后端交互耦合。

### 整体架构与数据流
- 主应用数据流：页面/Hook → Zustand store（`authStore`, `roomStore`, `websocketStore`, `gameStore`）→ WebSocket / REST → 服务端 → `WebSocketMessageListener` 回推 → store 更新。
- 认证状态集中在 `bar-game-frontend/src/store/authStore.ts`（localStorage key `BargameToken`），只能通过 store 方法（`getToken/setToken/login/updateUserField/clearAuth`）读写；禁止直接操作 `localStorage` 或在其他模块缓存 token。
- TypeScript 启用 `verbatimModuleSyntax` 与 `erasableSyntaxOnly`：仅类型导入必须使用 `import type { ... }`；`types/websocketMessages.ts` 中的 `MessageModule/StatusCode/...` 使用 `const` 对象，禁止魔法字符串模块名或裸数字状态码。

### 开发与构建工作流
- 根目录无统一脚本；分别在子项目中用 `pnpm dev|build|lint|preview`，默认端口：主应用 5173，登录微前端 5174。
- 构建 / 代理配置集中在各自 `vite.config.ts` 与 `src/config/index.ts`：
	- 主应用通过 `API_CONFIG` / `WS_CONFIG` 推导 REST 与 WebSocket 端点（Nginx 推荐 `/api` + `/api/ws`）。
	- 登录微前端通过 `config/index.ts` 中的 `baseURL`（默认 `/api`）访问后端。
- 部署时通常将主应用挂在根路径，将登录微前端挂到 `/login/`，具体示例见 `bar-game-frontend/README.md` 与 `docs/nginx-deployment.md`。

### 认证与登录通信约定
- 主应用登录页 `pages/Login.tsx` 通过 `LOGIN_IFRAME_CONFIG.IFRAME_URL` 嵌入登录微前端；允许域由 `LOGIN_IFRAME_CONFIG.ALLOWED_ORIGINS` 推导（优先 env，再取 iframe URL origin，最后同源）。`MessageListener` 忽略来源不在白名单中的 `postMessage`。
- 登录微前端在 `login-frontend/src/config/index.ts` 中解析 `VITE_PARENT_APP_ORIGINS` 或 `document.referrer` 建立 `messageConfig.allowedOrigins`，并通过 `components/postMessage.jsx` 的 `sendTokenToParent` / `sendErrorToParent` 向主应用发送 `LOGIN_SUCCESS|REGISTER_SUCCESS|LOGIN_ERROR|REGISTER_ERROR`。
- `bar-game-frontend` 中的 `components/common/MessageListener` 负责监听这些消息并写入 `authStore`，同时触发页面跳转或错误提示；新增字段时需保证兼容现有 `username` / `user` 结构。

### WebSocket 与 Store 模式
- 唯一 WebSocket 连接由 `bar-game-frontend/src/utils/WsConnection.ts` 管理，`WebSocketMessageListener` 根据 `authStore` token 自动 connect / retry / cleanup，并将所有消息交给 `useWebSocketStore.getState().handleMessage`。
- 注册消息处理：在页面或 hook 中调用 `useWebSocketStore().registerHandler({ module, cmd, handler, description })`，组件卸载时务必调用 `unregisterHandler(module, cmd)` 以防内存泄漏。
- 发送消息：
	- 请求-响应：使用 `useWebSocketStore().sendMessage(payload)`，内部会生成 `requestId`、挂起 Promise 并处理超时；默认 `expectResponse=true`。
	- 通知：使用 `sendMessage` 并传 `options.expectResponse=false`，或调用 `sendNotification` 封装方法。
- 新模块/命令或消息结构需先在 `types/websocketMessages.ts` 扩展（例如 `RoomCommand`, `GameCommand`, `HallCommand`），再在对应 hook / service 中注册 handler，具体模式可参考 `hooks/useRoomState.ts`、`hooks/useOnlineUsers.ts` 与 `docs/WebSocketUsage.md`。

### 房间、大厅与 REST 辅助方法
- `roomStore` 中 `currentRoom` 等字段更新遵循不可变数据（基于对象浅拷贝合并），不得在外部直接 mutate；`hooks/useRoomState.ts` 监听 `ROOM_MEMBERS_PUSH` / `ROOM_UPDATE` / `PLAYER_*` 等推送并通过 `setCurrentRoom` 更新。
- 在线用户：`hooks/useOnlineUsers.ts` 调用 `services/hallService.ts` 发起 `HALL:ONLINE_LIST` 请求，并订阅 `ONLINE_LIST` / `ONLINE_LIST_UPDATE` 通知；如需轮询或刷新列表，先检查 WebSocket 连接状态以避免错误。
- REST helpers：`src/utils/getRoomList.ts`, `createRoom.ts`, `getUserInfo.ts`, `joinRoom.ts`, `leaveRoom.ts` 等统一从 `useAuthStore.getState().getToken()` 取 token；遇到 401 / 鉴权错误时调用 `clearAuth()` 触发登出流程。新增 REST 接口时：
	- 先在 `bar-game-frontend/src/config/index.ts` 的 `API_CONFIG.ENDPOINTS` 中声明路径。
	- 再在 `src/utils/<feature>.ts` 中封装 `fetch` 调用，复用现有错误处理模式。

### WebRTC 信令与音视频
- 所有 WebRTC 信令通过 WebSocket 的 ROOM 模块发送，命令包括 `WEBRTC_OFFER` / `WEBRTC_ANSWER` / `ICE_CANDIDATE` 等（详见 `services/webRTCManager.ts` 与 `WebRTC语音通话功能-后端API改动文档.md`）。
- `WebRTCManager` 仅在显式 `initialize(roomId)` 后注册相关 handler，负责：
	- 缓存尚未 attach 的远端 ICE candidate；
	- 根据 `RTCPeerConnection.signalingState` 处理 glare；
	- 通过 `sendMessage(..., { expectResponse:false })` 发送信令通知。
- `hooks/useWebRTC.ts` 依赖「WebSocket 已连接」与 `roomStore.currentRoom` 才执行初始化，并在 `cleanup` 中注销 handler、关闭 `RTCPeerConnection` 和释放本地流；新增音视频功能时应在 hook 内组合现有管理逻辑，而不是在组件中直接操控 `RTCPeerConnection`。

### 登录微前端细节（login-frontend）
- `components/mobileLogin.tsx` 管理登录 / 注册模式切换，所有表单校验错误通过 `sendErrorToParent` 回传父页面，而不是在 iframe 内部自行导航。
- 后端认证接口封装位于 `src/utils/api/{login,auth}.js`，默认调用 `/auth/login` 与 `/auth/create`；扩展字段或接口时优先在这些封装中调整，再更新表单。
- `src/config/index.ts` 自动推导 `baseURL` 与 `messageConfig.allowedOrigins`；开发模式在缺省配置下允许 `*` 作为目标 origin 方便调试，生产环境必须通过 env 或同源策略收紧到具体 origin。

### 编码习惯与限制
- Zustand store / React state 更新必须保持不可变；除 `Map` 等特殊结构外，禁止在 hook 外部直接 mutate 对象或数组。
- 只能通过 `useAuthStore.getState().getToken()` 访问 token；禁止：
	- 在任意模块直接读写 `localStorage`；
	- 创建新的 WebSocket 实例或手动管理连接生命周期（统一交给 `WsConnection` + `websocketStore`）。
- WebSocket 命令 / 模块标识必须引用 `MessageModule`, `StatusCode` 和 `*Command` 等常量，严禁写死字符串，如 `module: 'HALL'` 或数字状态码 `200`。
- 新增 TypeScript 代码时遵守 `docs/WebSocketUsage.md` 中的导入风格（`import type` vs 普通导入），以避免编译器在 `verbatimModuleSyntax` 下报错。

### 其他注意事项
- WebSocket 心跳协议目前在 `WebSocketMessageListener` 中被注释，暂未启用；若要恢复，请先确认后端实现并在本文件补充说明。
- 如本说明覆盖不到你的新需求（例如新增游戏阶段、复杂 3D 组件或新的 WebRTC 流程），在实现前先补充本文件，约定新的 store / hook / 消息模式后再落地代码。
