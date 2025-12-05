# Bar Game Frontend

基于 React + Vite 的主应用，负责房间与实时通信逻辑，并通过 iframe 集成登录微前端。

## Nginx 部署示例

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/bar-game-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /login/ {
        alias /var/www/login-frontend/dist/;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ws {
        proxy_pass http://backend:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

将两个构建产物挂到同一域名（不同路径）后，postMessage、REST 与 WebSocket 都在同源策略下工作。

## 关键环境变量

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_LOGIN_IFRAME_URL` | 开发：`http(s)://<host>:5174`；生产：`<当前 origin>/login/` | 登录 iframe 的完整 URL，可指向独立域。 |
| `VITE_LOGIN_ALLOWED_ORIGINS` | 由 `VITE_LOGIN_IFRAME_URL` 的 origin 推导 | 逗号分隔的 origin 白名单，MessageListener 仅处理这些来源的 postMessage。 |

通常在 Nginx 中把登录微前端发布到 `/login/` 路径即可无需额外变量。若登录页面位于其它域，设置上述两个变量即可完成跨域校验。

## 构建

```bash
pnpm install
pnpm build
```

构建产物位于 `dist/`，拷贝到 Nginx 静态目录即可。
