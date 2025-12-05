import config from '../config'

/**
 * 简单的 PostMessage 工具组件
 * 用于向父应用传递 token 或错误消息，传递完成后 iframe 将被关闭
 */

/**
 * 发送 token 到父窗口
 * @param {string} token - 用户认证 token
 */
const getReferrerOrigin = () => {
  if (typeof document === 'undefined' || !document.referrer) {
    return ''
  }
  try {
    const url = new URL(document.referrer)
    return url.origin
  } catch (error) {
    console.warn('解析父页面来源失败:', error)
    return ''
  }
}

const resolveTargetOrigin = () => {
  const { allowedOrigins = [], useWildcardTarget } = config.messageConfig || {}

  if (useWildcardTarget) {
    return '*'
  }

  const referrerOrigin = getReferrerOrigin()
  if (referrerOrigin && allowedOrigins.includes(referrerOrigin)) {
    return referrerOrigin
  }

  return allowedOrigins[0] || '*'
}

const sendTokenToParent = (token) => {
  try {
    if (window.parent && window.parent !== window) {
      const targetOrigin = resolveTargetOrigin()
      // 发送 token 给父应用
      window.parent.postMessage({
        type: 'LOGIN_SUCCESS',
        token: token
      }, targetOrigin);
      console.log('Token 已发送给父应用:', token);

      // 传递完成后，iframe 将被父应用关闭
      // 这里不需要做任何额外操作，等待父应用处理即可
    } else {
      console.warn('未找到父窗口，无法发送 token');
    }
  } catch (error) {
    console.error('发送 token 失败:', error);
  }
};

/**
 * 发送错误消息到父窗口
 * @param {string} errorMessage - 错误消息
 * @param {string} type - 错误类型 ('LOGIN_ERROR' 或 'REGISTER_ERROR')
 */
const sendErrorToParent = (errorMessage, type = 'LOGIN_ERROR') => {
  try {
    if (window.parent && window.parent !== window) {
      const targetOrigin = resolveTargetOrigin()
      // 发送错误消息给父应用
      window.parent.postMessage({
        type: type,
        error: errorMessage
      }, targetOrigin);
      console.log('错误消息已发送给父应用:', errorMessage);
    } else {
      console.warn('未找到父窗口，无法发送错误消息');
    }
  } catch (error) {
    console.error('发送错误消息失败:', error);
  }
};

export { sendTokenToParent, sendErrorToParent };
export default sendTokenToParent;