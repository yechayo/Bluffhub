import { create } from 'zustand'
import type {
  WebSocketMessage,
  MessageHandlerConfig,
  MessageModule,
  PendingRequest,
  SendMessageOptions,
  WebSocketRequest
} from '../types/websocketMessages'
import { StatusCode } from '../types/websocketMessages'
import useAuthStore from './authStore'

// WebSocket状态管理接口
interface WebSocketStoreState {
  // 消息处理器注册表
  messageHandlers: Map<string, MessageHandlerConfig>

  // 待处理的请求（request-响应模式）
  pendingRequests: Map<string, PendingRequest>

  // WebSocket连接状态
  isConnected: boolean

  // 最后一条消息（用于调试）
  lastMessage: WebSocketMessage | null

  // 错误信息
  error: string | null

  // 连接健康状态
  isHealthy: boolean
  // 最近一次心跳响应时间戳（ms）
  lastHeartbeatAt: number | null
  // 最近一次心跳延迟（ms）
  lastHeartbeatLatencyMs: number | null
}

interface WebSocketStoreActions {
  // 注册消息处理器
  registerHandler: (config: MessageHandlerConfig) => void

  // 注销消息处理器
  unregisterHandler: (module: MessageModule, cmd: string) => void

  // 处理接收到的消息
  handleMessage: (message: WebSocketMessage) => void

  // 发送消息（支持请求-响应模式）
  sendMessage: <T = any>(message: Omit<WebSocketRequest, 'requestId'>, options?: SendMessageOptions) => Promise<WebSocketMessage & { data?: T }>

  // 发送通知（不需要响应）
  sendNotification: (message: Omit<WebSocketMessage, 'requestId'>) => void

  // 设置连接状态
  setConnectionStatus: (isConnected: boolean) => void

  // 清除待处理请求
  clearPendingRequests: () => void

  // 清除错误
  clearError: () => void

  // 重置store
  reset: () => void

  // 更新连接健康状态（心跳）
  updateHeartbeatHealth: (args: { lastHeartbeatAt: number; latencyMs: number }) => void
}

// 生成唯一requestId
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// 获取处理器key
const getHandlerKey = (module: MessageModule, cmd: string): string => {
  return `${module}:${cmd}`
}

// 创建WebSocket状态管理
export const useWebSocketStore = create<WebSocketStoreState & WebSocketStoreActions>((set, get) => ({
  // 初始状态
  messageHandlers: new Map(),
  pendingRequests: new Map(),
  isConnected: false,
  lastMessage: null,
  error: null,
  isHealthy: false,
  lastHeartbeatAt: null,
  lastHeartbeatLatencyMs: null,

  // 注册消息处理器
  registerHandler: (config: MessageHandlerConfig) => {
    const { messageHandlers } = get()
    const key = getHandlerKey(config.module, config.cmd)

    const newHandlers = new Map(messageHandlers)
    newHandlers.set(key, config)

    set({ messageHandlers: newHandlers })
  },

  // 注销消息处理器
  unregisterHandler: (module: MessageModule, cmd: string) => {
    const { messageHandlers } = get()
    const key = getHandlerKey(module, cmd)

    const newHandlers = new Map(messageHandlers)
    newHandlers.delete(key)

    set({ messageHandlers: newHandlers })
  },

  // 处理接收到的消息
  handleMessage: (message: WebSocketMessage) => {
    const { messageHandlers, pendingRequests } = get()

    // 更新最后一条消息
    set({ lastMessage: message })

    // 验证消息基本字段
    if (!message || !message.module || !message.cmd) {
      console.warn('WebSocket: 收到无效消息 (缺少 module 或 cmd)', message)
      return
    }

    // 如果是响应消息，处理待处理的请求
    if (message.requestId && pendingRequests.has(message.requestId)) {
      const pendingRequest = pendingRequests.get(message.requestId)!
      clearTimeout(pendingRequest.timeout)
      pendingRequest.resolve(message)

      const newPendingRequests = new Map(pendingRequests)
      newPendingRequests.delete(message.requestId)
      set({ pendingRequests: newPendingRequests })
      return
    }

    // 处理普通消息和通知
    const key = getHandlerKey(message.module, message.cmd)
    const handlerConfig = messageHandlers.get(key)

    if (handlerConfig) {
      try {
        // 异步执行处理器，不阻塞主线程
        const result = handlerConfig.handler(message)
        if (result instanceof Promise) {
          result.catch((error: any) => {
            console.error(`消息处理器执行错误 [${key}]:`, error)
            set({ error: `消息处理器错误: ${error?.message || String(error)}` })
          })
        }
      } catch (error: any) {
        console.error(`消息处理器同步错误 [${key}]:`, error)
        set({ error: `消息处理器错误: ${error?.message || String(error)}` })
      }
    } else {
      console.warn(`未找到消息处理器: ${key}`)
    }
  },

  // 发送消息（支持请求-响应模式）
  sendMessage: async <T = any>(
    message: Omit<WebSocketRequest, 'requestId'>,
    options: SendMessageOptions = {}
  ): Promise<WebSocketMessage & { data?: T }> => {
    const { isConnected } = get()
    if (!isConnected) {
      throw new Error('WebSocket未连接')
    }

    const token = useAuthStore.getState().getToken()
    if (!token) {
      throw new Error('用户未认证')
    }

    // 动态导入WsConnection避免循环依赖
    const { getWebSocket, sendMessage: sendWsMessage } = await import('../utils/WsConnection.js')
    const ws = getWebSocket()

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket连接不可用')
    }

    const requestId = generateRequestId()
    const fullMessage: WebSocketRequest = {
      ...message,
      requestId,
      code: message.code || StatusCode.SUCCESS,
      msg: message.msg || 'success'
    }

    // 如果期待响应，创建Promise
    if (options.expectResponse !== false) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const { pendingRequests } = get()
          const newPendingRequests = new Map(pendingRequests)
          newPendingRequests.delete(requestId)
          set({ pendingRequests: newPendingRequests })

          reject(new Error(`请求超时: ${requestId}`))
        }, options.timeout || 5000)

        const pendingRequest: PendingRequest = {
          resolve,
          reject,
          timeout
        }

        const { pendingRequests: currentPending } = get()
        const newPendingRequests = new Map(currentPending)
        newPendingRequests.set(requestId, pendingRequest)
        set({ pendingRequests: newPendingRequests })

        // 发送消息
        sendWsMessage(fullMessage)
      })
    } else {
      // 不期待响应，直接发送
      sendWsMessage(fullMessage)
      return fullMessage as WebSocketMessage & { data?: T }
    }
  },

  // 发送通知（不需要响应）
  sendNotification: (message: Omit<WebSocketMessage, 'requestId'>) => {
    const { isConnected } = get()
    if (!isConnected) {
      console.warn('WebSocket未连接，无法发送通知')
      return
    }

    // 动态导入避免循环依赖
    import('../utils/WsConnection.js').then(({ sendMessage: sendWsMessage }) => {
      const fullMessage = {
        ...message,
        code: message.code || StatusCode.SUCCESS,
        msg: message.msg || 'success'
      }
      sendWsMessage(fullMessage)
    })
  },

  // 设置连接状态
  setConnectionStatus: (isConnected: boolean) => {
    set({ isConnected })

    // 如果连接断开，清除所有待处理请求
    if (!isConnected) {
      get().clearPendingRequests()
      // 连接断开，健康状态重置为不健康
      set({ isHealthy: false })
    }
  },

  // 清除待处理请求
  clearPendingRequests: () => {
    const { pendingRequests } = get()

    // 清除所有定时器
    pendingRequests.forEach(request => {
      clearTimeout(request.timeout)
    })

    set({ pendingRequests: new Map() })
  },

  // 清除错误
  clearError: () => {
    set({ error: null })
  },

  // 重置store
  reset: () => {
    get().clearPendingRequests()
    set({
      messageHandlers: new Map(),
      isConnected: false,
      lastMessage: null,
      error: null,
      isHealthy: false,
      lastHeartbeatAt: null,
      lastHeartbeatLatencyMs: null
    })
  },

  // 更新连接健康状态（心跳）
  updateHeartbeatHealth: ({ lastHeartbeatAt, latencyMs }) => {
    set({
      isHealthy: true,
      lastHeartbeatAt,
      lastHeartbeatLatencyMs: latencyMs
    })
  }
}))

// 导出便捷hooks
export const useWebSocketMessage = () => {
  const registerHandler = useWebSocketStore(state => state.registerHandler)
  const unregisterHandler = useWebSocketStore(state => state.unregisterHandler)
  const lastMessage = useWebSocketStore(state => state.lastMessage)
  const isConnected = useWebSocketStore(state => state.isConnected)
  const error = useWebSocketStore(state => state.error)

  return {
    registerHandler,
    unregisterHandler,
    lastMessage,
    isConnected,
    error
  }
}

export const useWebSocketSender = () => {
  const sendMessage = useWebSocketStore(state => state.sendMessage)
  const sendNotification = useWebSocketStore(state => state.sendNotification)
  const isConnected = useWebSocketStore(state => state.isConnected)

  return {
    sendMessage,
    sendNotification,
    isConnected
  }
}

export default useWebSocketStore