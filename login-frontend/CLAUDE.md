# 登录表单微前端项目

## 项目概述
这是一个登录表单的微前端页面项目，基于React 18和Vite构建。该项目通过iframe方式集成到主页面中，提供用户注册和登录功能。登录成功后，使用postMessage方式将token传递给主前端应用。

## 技术栈
- **前端框架**: React 18.3.1
- **构建工具**: Vite 6.0.7
- **开发语言**: TypeScript
- **样式**: CSS

## 项目结构
```
login-frontend/
├── src/
│   ├── App.tsx           # 主应用组件（目前是默认的Vite模板）
│   ├── main.tsx          # 应用入口文件
│   ├── App.css           # 应用样式
│   └── assets/           # 静态资源
├── public/               # 公共资源
├── dist/                 # 构建输出目录
├── package.json          # 项目依赖配置
├── tsconfig.json         # TypeScript配置
├── vite.config.ts        # Vite构建配置
└── README.md            # 项目说明文档
```

## 核心功能设计

### 1. 用户注册功能
- 新用户注册表单
- 表单验证
- 注册成功处理

### 2. 用户登录功能
- 用户名/密码登录
- 登录状态验证
- 记住登录状态

### 3. 与主前端通信
- 使用 `postMessage` API 进行跨域通信
- 登录成功后发送token给主页面
- 监听主页面的消息请求

## 集成方式

### iframe集成
```html
<iframe
  src="登录页面URL"
  width="400"
  height="500"
  frameborder="0">
</iframe>
```

### postMessage通信协议
```javascript
// 登录成功后发送token给父页面
window.parent.postMessage({
  type: 'LOGIN_SUCCESS',
  token: 'user_auth_token',
  userInfo: { /* 用户信息 */ }
}, '主页面域名');
```

## 开发指南

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 预览构建结果
```bash
npm run preview
```

## 安全考虑
- 实施适当的CORS策略
- postMessage通信需要验证目标域名
- token应该设置合理的过期时间
- 考虑实施CSRF保护

## 部署说明
- 构建后的文件位于 `dist/` 目录
- 需要配置HTTPS以确保安全通信
- 建议使用CDN加速静态资源加载

## 当前状态
项目目前处于初始化阶段，使用的是Vite的默认模板。需要实现具体的登录、注册功能以及与主页面的通信逻辑。

## 后续开发任务
1. 实现用户注册表单组件
2. 实现用户登录表单组件
3. 集成后端API调用
4. 实现postMessage通信逻辑
5. 添加错误处理和用户体验优化
6. 实现响应式设计适配不同iframe尺寸