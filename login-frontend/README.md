# Login Frontend

登录/注册表单的微前端，通过 iframe 嵌入到主应用，成功后使用 `postMessage` 返回 token。

## 与主应用通信

- `postMessage` 目标域名依据 `document.referrer` 自动判定。
- 只有在 `messageConfig.allowedOrigins` 白名单中的父页面才会收到消息。
- 主应用需在 iframe 中加载此构建产物，例如 `/login/index.html`。

## 环境变量

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | 后端 API 代理前缀。部署在同域 Nginx 时保持默认即可。 |
| `VITE_PARENT_APP_ORIGINS` | 开发：常见本地域名；生产：`window.location.origin` | 逗号分隔的父页面 origin 列表，用于校验 postMessage 来源并决定发送目标。 |

当 `VITE_PARENT_APP_ORIGINS` 未设置且处于开发模式时，会回落到 `*` 作为 `postMessage` 目标，方便本地调试；生产环境默认要求与本应用同源。

## 构建

```bash
pnpm install
pnpm build
```

将 `dist/` 发布到 Nginx，例如挂载到 `/login/` 后即可被主应用 iframe 引用。
