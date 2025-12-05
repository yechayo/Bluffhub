# Bluffhub

酒吧桌游平台的 Monorepo，包含两个 Vite/React 前端（主应用与登录微前端）和一个 Spring Boot 后端。

## 目录结构

- `bar-game-frontend/`：主游戏界面、房间大厅、WebSocket + WebRTC 逻辑，通过 iframe 引入登录页。
- `login-frontend/`：登录/注册微前端，完成后用 `postMessage` 把 token 发送给父页面。
- `bargame-backend/`：Spring Boot 3 服务，内含 WebSocket、MyBatis-Plus、JWT、MySQL 支持。

## 环境要求

- 前端：Node.js 18+、`pnpm`。
- 后端：JDK 17+、Maven 3.9+。
- 数据库：MySQL（在 `src/main/resources/application.yml` 配置连接和凭据）。

## 快速开始

### 主前端（`bar-game-frontend`）

```bash
pnpm install
pnpm dev
```

关键环境变量（详见子目录 `README.md`）：
- `VITE_LOGIN_IFRAME_URL`：登录 iframe 地址，生产默认 `/login/`。
- `VITE_LOGIN_ALLOWED_ORIGINS`：允许 `postMessage` 的 origin，逗号分隔。

### 登录前端（`login-frontend`）

```bash
pnpm install
pnpm dev -- --port 5174
```

环境变量：
- `VITE_API_BASE_URL`：API 前缀，默认 `/api`。
- `VITE_PARENT_APP_ORIGINS`：父页面 origin 列表（逗号分隔），用于校验 `postMessage` 来源。

### 后端（`bargame-backend`）

```bash
mvn spring-boot:run
```

- 使用 Java 17；运行前在 `application.yml` 更新数据库和 JWT 配置。
- 暴露 REST 与 WebSocket 接口，前端通过 `/api`、`/api/ws` 代理。

## 构建与部署

- 前端：`pnpm build` 生成 `dist/`，用 Nginx 等静态服务托管。示例 Nginx 配置见 `bar-game-frontend/README.md`。
- 后端：`mvn clean package` 产出可运行 jar。
- 常见部署：主站挂载 `/`，登录页挂载 `/login/`，`/api` 与 `/api/ws` 反向代理到后端。

## 相关文档

- `bar-game-frontend/docs/WebSocketUsage.md`：前端 WebSocket 消息流程。
- `bar-game-frontend/WebRTC语音通话功能-后端API改动文档.md`：WebRTC 语音通话的后端改动说明。
