/**
 * 应用配置文件
 */

// 根据环境变量设置不同的基础URL
const getBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  return '/api'
}

const getWindowOrigin = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5174'
  }
  return window.location.origin
}

const parseEnvOrigins = (value?: string) => {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const getAllowedParentOrigins = () => {
  const envOrigins = parseEnvOrigins(import.meta.env.VITE_PARENT_APP_ORIGINS)
  if (envOrigins.length > 0) {
    return envOrigins
  }

  if (import.meta.env.DEV) {
    return [
      'http://localhost:5173',
      'https://localhost:5173',
      'http://127.0.0.1:5173',
      'https://127.0.0.1:5173',
      'http://192.168.137.144:5173',
      'https://192.168.137.144:5173'
    ]
  }

  return [getWindowOrigin()]
}

const allowedParentOrigins = getAllowedParentOrigins()
const shouldUseWildcardTarget = import.meta.env.DEV && !import.meta.env.VITE_PARENT_APP_ORIGINS

export const config = {
  // API基础URL
  baseURL: getBaseURL(),

  // 请求超时时间（毫秒）
  timeout: 10000,

  // 是否开启请求日志
  enableLogging: import.meta.env.DEV,

  // postMessage通信配置
  messageConfig: {
    // 允许的父页面域名（生产环境需要设置具体域名）
    allowedOrigins: allowedParentOrigins,
    useWildcardTarget: shouldUseWildcardTarget,
  }
}

export default config