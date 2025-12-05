# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个**3D虚拟酒吧游戏**的前端应用，采用双前端架构：
- **login-frontend** - 用户登录微前端（iframe集成）
- **bar-game-frontend** - 主游戏应用（React + 3D渲染）

支持用户认证、3D模型渲染、WebSocket实时通信等现代Web应用特性。

## 技术栈

### 核心框架
- **React 19.2.0** + **TypeScript 5.9.3**
- **Vite 7.2.2** - 构建工具
- **React Router DOM 7.9.5** - 路由管理

### 3D渲染
- **React Three Fiber 9.4.0** - Three.js的React渲染器
- **@react-three/drei 10.7.7** - R3F辅助库
- **Three.js 0.181.1** - 3D图形库
- **MMD模型支持** - 支持MikuMikuDance 3D模型
- **HDR环境贴图** - PBR渲染

### 状态管理与通信
- **Zustand 5.0.8** - 轻量级状态管理
- **WebSocket** - 实时通信（`ws://192.168.137.144:8080`）
- **postMessage API** - iframe跨域通信

### UI组件
- **Ant Design 5.28.1** - UI组件库
- **@ant-design/v5-patch-for-react-19** - React 19兼容性补丁
- **Less 4.4.2** - CSS预处理器

### 代码质量
- **ESLint 9.39.1** - 代码检查
- **pnpm** - 包管理器

## 项目结构

```
bigrich/
├── bar-game-frontend/        # 主游戏应用
│   ├── src/
│   │   ├── components/       # 组件库
│   │   │   ├── 3d-components/    # 3D相关组件
│   │   │   │   ├── box/
│   │   │   │   ├── head-controller/  # 头部控制
│   │   │   │   ├── mmd/            # MMD模型组件
│   │   │   │   └── sit-controller/  # 座位控制
│   │   │   └── common/       # 通用组件
│   │   ├── pages/            # 页面组件
│   │   │   ├── GameBar.tsx   # 游戏大厅
│   │   │   └── Login.tsx     # 登录页
│   │   ├── store/            # Zustand状态管理
│   │   │   ├── authStore.ts  # 认证状态
│   │   │   └── websocketStore.ts  # WebSocket状态
│   │   ├── services/         # API服务
│   │   ├── hooks/            # 自定义Hooks
│   │   │   ├── useOnlineUsers.ts  # 在线用户Hook
│   │   │   └── useUserInfo.ts     # 用户信息Hook
│   │   ├── types/            # TypeScript类型定义
│   │   │   └── websocketMessages.ts  # WebSocket消息类型
│   │   ├── utils/            # 工具函数
│   │   │   └── WsConnection.ts     # WebSocket连接管理
│   │   ├── config/           # 配置文件
│   │   │   └── index.ts      # 应用配置
│   │   ├── App.tsx           # 应用入口组件
│   │   └── main.tsx          # 应用入口文件
│   ├── public/               # 静态资源
│   │   ├── font/             # 字体文件
│   │   ├── hdr/              # HDR贴图
│   │   ├── mmd/              # 3D模型文件
│   │   └── lei/              # 角色模型
│   ├── package.json
│   └── eslint.config.js
│
├── login-frontend/           # 登录微前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── login.tsx     # 登录组件
│   │   │   └── postMessage.jsx  # 跨域通信
│   │   ├── utils/
│   │   ├── assets/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   └── package.json
│
└── CLAUDE.md                 # 本文件
```

## 架构设计

### 状态管理 (Zustand)

#### authStore.ts
- 管理用户认证状态（token、用户信息、登录状态）
- 提供登录/登出/更新用户信息方法
- 持久化token到localStorage
- 初始化时检查localStorage中的token

#### websocketStore.ts
- 管理WebSocket连接状态和消息处理
- 支持请求-响应模式和通知模式
- 注册消息处理器机制
- 自动处理待处理请求的超时和清理

### WebSocket通信架构

**消息格式** (websocketMessages.ts):
```typescript
{
  requestId?: string,  // 请求唯一标识
  module: 'HALL' | 'ROOM' | 'GAME',  // 业务模块
  cmd: string,         // 指令类型
  code: StatusCode,    // 状态码
  msg: string,         // 状态描述
  data?: any           // 业务数据
}
```

**三种消息类型**:
1. **Request** - 需要requestId，期待响应
2. **Response** - 响应消息，与请求的requestId对应
3. **Notification** - 服务器推送，无需requestId

**连接管理** (WsConnection.ts):
- 单例WebSocket连接
- 自动处理连接状态
- 消息发送封装

### 页面架构

#### Login.tsx
- iframe集成登录微前端
- 通过postMessage接收认证结果
- 自动检测localStorage中的token
- 登录成功后跳转到游戏大厅

#### GameBar.tsx
- 游戏大厅主界面
- 左侧：用户信息和在线用户列表
- 右侧：房间列表和创建房间
- 背景3D场景渲染

### 3D组件架构

**核心组件**:
- **StartFont** - 3D字体显示组件
- **HeadController** - 3D模型头部控制
- **SitController** - 3D模型座位控制
- **MMD组件** - MMD模型渲染和动画
- **Background** - 3D背景场景

**3D渲染流程**:
1. React Three Fiber创建Canvas
2. 加载HDR环境贴图
3. 渲染3D模型和字体
4. 集成控制器组件

## 开发命令

### bar-game-frontend (主应用)

```bash
# 开发模式启动（端口5173）
cd bar-game-frontend
pnpm dev
# 或
npm run dev

# 构建生产版本
pnpm build

# 代码检查
pnpm lint

# 预览构建结果
pnpm preview
```

### login-frontend (登录微前端)

```bash
# 开发模式启动（端口5174）
cd login-frontend
pnpm dev

# 构建生产版本
pnpm build

# 代码检查
pnpm lint

# 预览构建结果
pnpm preview
```

### 同时启动两个应用

需要启动两个终端窗口，分别在两个目录中运行开发命令。

## 服务器配置

### 开发环境
- **API服务器**: `http://192.168.137.144:8080`
- **WebSocket服务器**: `ws://192.168.137.144:8080`
- **登录微前端**: `http://localhost:5174`
- **主游戏应用**: `http://localhost:5173`

### 生产环境
同域部署可以通过 Nginx 统一托管两个前端并反向代理接口。推荐拓扑：

```
https://example.com/           -> bar-game-frontend/dist
https://example.com/login/     -> login-frontend/dist
https://example.com/api/*      -> 后端 REST
https://example.com/api/ws     -> 后端 WebSocket 升级
```

关键配置位于各自 `src/config/index.ts`，均支持通过环境变量覆盖：

| 项目 | 变量 | 说明 |
| --- | --- | --- |
| bar-game-frontend | `VITE_LOGIN_IFRAME_URL` | 登录 iframe 的完整 URL，默认开发期指向 `http(s)://<host>:5174`，生产期回落到 `<origin>/login/`。 |
| bar-game-frontend | `VITE_LOGIN_ALLOWED_ORIGINS` | 逗号分隔的 origin 白名单；若未设置则自动取 iframe URL 的 origin，用于 MessageListener 的来源校验。 |
| login-frontend | `VITE_PARENT_APP_ORIGINS` | 允许接收 `postMessage` 的父页面 origin 列表。省略时生产环境默认为当前 origin，开发环境则回落到常用本地地址并在必要时使用 `*` 发送。 |
| login-frontend | `VITE_API_BASE_URL` | 后端 API 前缀，默认为 `/api` 以便依赖 Nginx 反代；如需跨域可填写完整地址。 |

bar-game-frontend 的 WebSocket URL 仍基于 `window.location` 推导，通过 `/api/ws?token=...` 发起同源连接，由 Nginx 转发到真实后端。

## 关键开发指南

### 添加新的WebSocket消息处理器

1. 在 `src/types/websocketMessages.ts` 中定义消息类型
2. 在组件中使用 `useWebSocketStore` 注册处理器:

```typescript
const { registerHandler } = useWebSocketMessage();

useEffect(() => {
  registerHandler({
    module: 'HALL',
    cmd: 'USER_LIST',
    handler: (message) => {
      // 处理消息
    },
    description: '获取在线用户列表'
  });
}, []);
```

### 添加新的页面

1. 在 `src/pages/` 创建页面组件
2. 在 `src/App.tsx` 中添加路由
3. 更新导航逻辑

### 添加3D组件

1. 在 `src/components/3d-components/` 下创建组件
2. 使用 `@react-three/fiber` 和 `@react-three/drei`
3. 参考现有组件的实现模式

### 修改API或WebSocket配置

编辑 `src/config/index.ts`:
- 修改 `API_CONFIG` 中的URL和端点
- 修改 `WS_CONFIG` 中的连接逻辑
- 开发环境使用相对路径，生产环境使用完整URL

## ESLint配置

项目使用ESLint 9 + TypeScript规则：
- 标准JavaScript/TypeScript规则
- React Hooks规则
- React刷新规则
- 忽略 `dist/` 目录

配置位于各项目的 `eslint.config.js`

## 包管理

- 使用 **pnpm** 作为包管理器
- 所有依赖锁定在 `pnpm-lock.yaml`
- 主应用依赖较重（包含Three.js相关包）
- 登录微前端依赖较轻（纯React）

## 常见工作流

### 开发新功能

1. 启动开发服务器（两个终端）
2. 修改代码（支持热重载）
3. 运行 `pnpm lint` 检查代码
4. 测试功能
5. 构建验证 `pnpm build`

### 添加WebSocket功能

1. 定义消息类型和接口
2. 在store中实现发送逻辑
3. 注册消息处理器
4. 在组件中使用hook

### 修改3D场景

1. 关注 `src/components/3d-components/`
2. 理解React Three Fiber生命周期
3. 注意性能优化（使用 memo, useMemo 等）

## 注意事项

1. **WebSocket连接依赖认证token** - 确保在登录后建立连接
2. **MMD模型文件较大** - 部署时使用CDN加速
3. **React 19兼容性** - 使用了官方兼容性补丁
4. **iframe跨域通信** - 使用postMessage进行安全通信
5. **开发服务器端口** - 主应用5173，登录微前端5174

## 近期提交历史

- 完善用户认证系统和信息管理功能
- 优化3D字体显示、在线用户管理和登录界面
- 添加WebSocket实时通信功能和在线用户统计
- 优化游戏大厅界面和登录体验

---

更多信息请参考各子目录的README.md文件。
