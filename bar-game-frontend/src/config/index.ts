/**
 * 应用配置文件
 * 统一管理所有URL和配置项
 */

const getWindowSafe = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window;
};

const resolveLoginIframeUrl = () => {
  const envUrl = import.meta.env.VITE_LOGIN_IFRAME_URL;
  if (envUrl) return envUrl;

  const win = getWindowSafe();
  if (!win) {
    return '/login/';
  }

  if (import.meta.env.DEV) {
    return `${win.location.protocol}//${win.location.hostname}:5174`;
  }

  return `${win.location.origin}/login/`;
};

const resolveLoginIframeOrigin = (iframeUrl: string) => {
  const win = getWindowSafe();
  try {
    if (iframeUrl) {
      return new URL(iframeUrl, win?.location.origin).origin;
    }
  } catch (error) {
    console.warn('[config] Failed to derive login iframe origin:', error);
  }
  return win?.location.origin ?? '';
};

const parseAllowedOrigins = (origin: string) => {
  const envValue = import.meta.env.VITE_LOGIN_ALLOWED_ORIGINS;
  if (envValue && envValue.trim().length > 0) {
    return envValue
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean);
  }
  return origin ? [origin] : [];
};

const LOGIN_IFRAME_URL = resolveLoginIframeUrl();
const LOGIN_IFRAME_ORIGIN = resolveLoginIframeOrigin(LOGIN_IFRAME_URL);

export const LOGIN_IFRAME_CONFIG = {
  IFRAME_URL: LOGIN_IFRAME_URL,
  IFRAME_ORIGIN: LOGIN_IFRAME_ORIGIN,
  ALLOWED_ORIGINS: parseAllowedOrigins(LOGIN_IFRAME_ORIGIN),
};

// 基础API配置
const DEV_API_BASE_URL = import.meta.env.VITE_DEV_API_BASE_URL;

export const API_CONFIG = {
  // 开发环境优先使用 VITE_DEV_API_BASE_URL，空值时退回到相对路径代理
  // 生产环境也使用相对路径，以便通过 nginx 同源反向代理转发到后端服务
  BASE_URL: import.meta.env.DEV && DEV_API_BASE_URL ? DEV_API_BASE_URL : '',

  // WebSocket连接URL - 在浏览器端构建时使用相对协议和主机，同源连接以便 nginx 转发
  // 例如：页面是 https://example.com，则 ws 协议应为 wss://example.com
  WS_URL: (() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // 包含端口
    return `${proto}//${host}`;
  })(),
  
  // API端点
  ENDPOINTS: {
    // WebSocket端点
    WEBSOCKET: '/api/ws',
    
    // 其他API端点可以在这里添加
    USER_INFO: '/api/user/info',
    ROOM_CREATE: '/api/room/create',
    ROOM_LIST: '/api/room/list',
  }
};

// WebSocket配置
export const WS_CONFIG = {
  // 完整的WebSocket连接URL模板
  getConnectionUrl: (token: string) => {
    // 开发环境直接连接到 8090 端口
    if (import.meta.env.DEV) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//192.168.137.99:8090/api/ws?token=${encodeURIComponent(token)}`;
    }
    // 生产环境使用相对路径
    return `${API_CONFIG.WS_URL}${API_CONFIG.ENDPOINTS.WEBSOCKET}?token=${encodeURIComponent(token)}`;
  },
  
  // 重连配置
  RECONNECT: {
    MAX_ATTEMPTS: 5,
    DELAY: 3000, // 3秒
  }
};

// 应用环境配置
export const ENV_CONFIG = {
  // 当前环境
  NODE_ENV: import.meta.env.MODE || 'development',
  
  // 是否为开发环境
  isDevelopment: () => import.meta.env.DEV,
  
  // 是否为生产环境
  isProduction: () => import.meta.env.PROD,
};

// 导出默认配置
export default {
  API: API_CONFIG,
  WS: WS_CONFIG,
  ENV: ENV_CONFIG,
  LOGIN_IFRAME: LOGIN_IFRAME_CONFIG,
};