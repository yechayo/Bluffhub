/**
 * WebSocket 连接管理
 * 连接地址通过配置文件管理
 * 需要在握手时通过 Spring Security 认证
 */

import { WS_CONFIG } from '../config';

// WebSocket 连接实例
let ws: WebSocket | null = null;
// 心跳定时器
let heartbeatTimer: number | null = null;
// 心跳间隔（毫秒）
const DEFAULT_HEARTBEAT_INTERVAL = 30000;
// 最近一次心跳发送时间戳
let lastHeartbeatSentAt: number | null = null;

// WebSocket 连接状态
export const WS_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

/**
 * 获取 WebSocket 连接
 * @returns {WebSocket} WebSocket 实例
 */
export const getWebSocket = (): WebSocket | null => ws;

/**
 * 获取当前连接状态
 * @returns {number} WebSocket 连接状态
 */
export const getConnectionState = (): number => ws ? ws.readyState : WS_STATES.CLOSED;

/**
 * 连接 WebSocket
 * @param {string} token - JWT 认证令牌
 * @returns {WebSocket} WebSocket 实例
 */
export function connectWebSocket(token: string): WebSocket | null {
  if (ws && ws.readyState === WS_STATES.OPEN) {
    console.log('WebSocket 已连接');
    return ws;
  }

  if (!token) {
    console.error('WebSocket 连接需要认证 token');
    return null;
  }

  // 构建 WebSocket URL，将 token 作为查询参数
  const wsUrl = WS_CONFIG.getConnectionUrl(token);

  console.log('正在连接 WebSocket:', wsUrl);

  try {
    ws = new WebSocket(wsUrl);

    // 连接成功事件
    ws.onopen = () => {
      console.log('WebSocket 连接成功');
      // 启动心跳
      startHeartbeat();
    };

    // 接收消息事件 - 注意：实际的消息处理已移至WebSocketMessageListener组件
    // 这里保留简单的日志，实际业务逻辑请使用WebSocketMessageListener组件
    ws.onmessage = (event) => {
      console.log('收到 WebSocket 消息:', event.data);
      // 注意：消息处理逻辑已移至WebSocketMessageListener组件
      // 如需处理消息，请在组件中使用useWebSocketStore注册处理器
    };

    // 连接错误事件
    ws.onerror = (error) => {
      console.error('WebSocket 连接错误:', error);
    };

    // 连接关闭事件
    ws.onclose = (event) => {
      console.log('WebSocket 连接关闭:', event.code, event.reason);
      ws = null;
      // 停止心跳
      stopHeartbeat();
    };

    return ws;
  } catch (error) {
    console.error('创建 WebSocket 连接失败:', error);
    return null;
  }
}

/**
 * 断开 WebSocket 连接
 */
export function disconnectWebSocket(): void {
  if (ws) {
    ws.close();
    ws = null;
    console.log('WebSocket 连接已断开');
  }
}

/**
 * 发送消息
 * @param {string|Object} message - 要发送的消息
 */
export function sendMessage(message: string | object): void {
  if (ws && ws.readyState === WS_STATES.OPEN) {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    ws.send(data);
    console.log('发送 WebSocket 消息:', data);
  } else {
    console.error('WebSocket 未连接，无法发送消息');
  }
}

/**
 * 发送一次心跳消息
 * payload 结构遵循约定：
 * {
 *   requestId: string,
 *   module: 'SYSTEM',
 *   cmd: 'HEARTBEAT',
 *   code: 200,
 *   msg: 'success',
 *   data: null
 * }
 */
export function sendHeartbeat(): void {
  if (!ws || ws.readyState !== WS_STATES.OPEN) {
    return;
  }
  const requestId = `hb_${new Date().toISOString()}`;
  const payload = {
    requestId,
    module: 'SYSTEM',
    cmd: 'HEARTBEAT',
    code: 200,
    msg: 'success',
    data: null
  };
  sendMessage(payload);
  lastHeartbeatSentAt = Date.now();
}

/**
 * 开始周期性心跳
 * @param interval 心跳间隔，默认 30s
 */
export function startHeartbeat(interval: number = DEFAULT_HEARTBEAT_INTERVAL): void {
  // 避免重复启动
  stopHeartbeat();
  // 立即发送一次
  sendHeartbeat();
  // 周期发送
  heartbeatTimer = (setInterval(() => {
    sendHeartbeat();
  }, interval) as unknown) as number;
}

/**
 * 停止周期性心跳
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer as unknown as number);
    heartbeatTimer = null;
  }
}

/**
 * 获取最近一次心跳发送时间
 */
export function getLastHeartbeatSentAt(): number | null {
  return lastHeartbeatSentAt;
}