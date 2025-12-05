import { useEffect, useCallback, useRef } from 'react'
import { useWebSocketStore } from '../../../store/websocketStore'
import { connectWebSocket, disconnectWebSocket } from '../../../utils/WsConnection.js'
import { getLastHeartbeatSentAt, startHeartbeat, stopHeartbeat } from '../../../utils/WsConnection.js'
import useAuthStore from '../../../store/authStore'
import type { WebSocketMessage, SystemReconnectPayload } from '../../../types/websocketMessages'
import { MessageModule, SystemCommand } from '../../../types/websocketMessages'
import { handleReconnectSync } from '../../../utils/reconnectSync'

interface WebSocketMessageListenerProps {
  // 自动连接，默认为true
  autoConnect?: boolean

  // 连接重试次数，默认为3
  maxRetries?: number

  // 重连间隔（毫秒），默认为5000
  retryInterval?: number

  // 心跳间隔（毫秒），默认为30000
  // heartbeatInterval?: number

  // 调试模式，默认为false
  debug?: boolean

  // 连接状态变化回调
  onConnectionChange?: (isConnected: boolean) => void

  // 连接错误回调
  onError?: (error: string) => void
}

/**
 * WebSocket消息监听组件
 * 统一管理WebSocket连接和消息处理
 */
const WebSocketMessageListener = ({
  autoConnect = true,
  maxRetries = 3,
  retryInterval = 5000,
  // heartbeatInterval = 30000,
  debug = false,
  onConnectionChange,
  onError
}: WebSocketMessageListenerProps) => {
  const {
    handleMessage,
    setConnectionStatus,
    clearPendingRequests,
    clearError,
    error,
    registerHandler,
    unregisterHandler,
    updateHeartbeatHealth
  } = useWebSocketStore()

  const { isAuthenticated, getToken } = useAuthStore()

  // 重试计数
  const retryCount = useRef(0)
  // 心跳定时器
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // 重连定时器
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 清理所有定时器
  const clearAllTimers = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current)
      heartbeatTimer.current = null
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }, [])

  // 启动心跳 - 已注释，后端没有相关处理
  // const startHeartbeat = useCallback(() => {
  //   if (heartbeatTimer.current) {
  //     clearInterval(heartbeatTimer.current)
  //   }

  //   heartbeatTimer.current = setInterval(() => {
  //     const ws = getWebSocket()
  //     if (ws && ws.readyState === WebSocketStatus.OPEN) {
  //       // 发送心跳消息
  //       ws.send(JSON.stringify({
  //         module: 'HALL',
  //         cmd: 'HEARTBEAT',
  //         code: 200,
  //         msg: 'ping'
  //       }))

  //       if (debug) {
  //         console.log('WebSocket: 发送心跳')
  //       }
  //     }
  //   }, heartbeatInterval)
  // }, [heartbeatInterval, debug])

  // 停止心跳 - 已注释，后端没有相关处理
  // const stopHeartbeat = useCallback(() => {
  //   if (heartbeatTimer.current) {
  //     clearInterval(heartbeatTimer.current)
  //     heartbeatTimer.current = null
  //   }
  // }, [])

  // 连接WebSocket
  const connect = useCallback(() => {
    const token = getToken()
    if (!token) {
      if (debug) {
        console.warn('WebSocket: 无法连接，用户未认证')
      }
      return
    }

    if (debug) {
      console.log(`WebSocket: 开始连接 (尝试 ${retryCount.current + 1}/${maxRetries})`)
    }

    const ws = connectWebSocket(token)
    if (!ws) {
      if (debug) {
        console.error('WebSocket: 连接失败')
      }
      return
    }

    // 设置消息处理
    ws.onmessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)

        if (debug) {
          console.log('WebSocket: 收到消息', message)
        }

        // 处理消息
        handleMessage(message)
      } catch (error) {
        console.error('WebSocket: 解析消息失败', error)
      }
    }

    // 设置连接状态处理
    ws.onopen = () => {
      if (debug) {
        console.log('WebSocket: 连接成功')
      }

      retryCount.current = 0
      setConnectionStatus(true)
      clearError()
      onConnectionChange?.(true)
      // 启动心跳（WsConnection 中统一发送格式）
      startHeartbeat()
    }

    ws.onclose = (event: CloseEvent) => {
      if (debug) {
        console.log('WebSocket: 连接关闭', event.code, event.reason)
      }

      setConnectionStatus(false)
      clearPendingRequests()
      // 停止心跳
      stopHeartbeat()
      onConnectionChange?.(false)

      // 如果是非正常关闭且已认证，尝试重连
      if (event.code !== 1000 && isAuthenticated && retryCount.current < maxRetries) {
        retryCount.current++

        if (debug) {
          console.log(`WebSocket: ${retryInterval / 1000}秒后重连...`)
        }

        reconnectTimer.current = setTimeout(() => {
          connect()
        }, retryInterval)
      }
    }

    ws.onerror = (error: Event) => {
      console.error('WebSocket: 连接错误', error)

      const errorMessage = 'WebSocket连接错误'
      onError?.(errorMessage)

      // 注意：onerror通常会在onclose之前触发，所以不需要单独设置连接状态
    }
  }, [
    getToken,
    debug,
    maxRetries,
    retryInterval,
    handleMessage,
    setConnectionStatus,
    clearPendingRequests,
    clearError,
    onConnectionChange,
    onError,
    isAuthenticated,
    // startHeartbeat, // 已注释，后端没有相关处理
    // stopHeartbeat // 已注释，后端没有相关处理
  ])

  // 断开连接
  const disconnect = useCallback(() => {
    clearAllTimers()
    // stopHeartbeat() // 已注释，后端没有相关处理
    disconnectWebSocket()
    retryCount.current = 0
  }, [clearAllTimers])

  // 监听认证状态变化
  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connect()
    } else if (!isAuthenticated) {
      disconnect()
    }

    return () => {
      if (!isAuthenticated) {
        disconnect()
      }
    }
  }, [isAuthenticated, autoConnect, connect, disconnect])

  // 监听store中的错误
  useEffect(() => {
    if (error) {
      onError?.(error)
    }
  }, [error, onError])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearAllTimers()
      // stopHeartbeat() // 已注释，后端没有相关处理
      disconnect()
    }
  }, [clearAllTimers, disconnect])

  // 注册 SYSTEM:HEARTBEAT 响应处理（轻量日志与延迟监控）
  useEffect(() => {
    const key = { module: 'SYSTEM' as const, cmd: 'HEARTBEAT' }

    registerHandler({
      module: key.module,
      cmd: key.cmd,
      description: '系统心跳响应处理',
      handler: (message) => {
        if (debug) {
          console.log('WebSocket: 心跳响应', message)
        }
        const sentAt = getLastHeartbeatSentAt()
        const now = Date.now()
        const latency = sentAt ? Math.max(0, now - sentAt) : 0
        updateHeartbeatHealth({ lastHeartbeatAt: now, latencyMs: latency })
      }
    })

    return () => {
      unregisterHandler(key.module, key.cmd)
    }
  }, [registerHandler, unregisterHandler, updateHeartbeatHealth, debug])

  // 注册 SYSTEM:RECONNECT 重连同步处理
  useEffect(() => {
    const { user } = useAuthStore.getState()
    
    registerHandler({
      module: MessageModule.SYSTEM,
      cmd: SystemCommand.RECONNECT,
      description: '重连同步处理 - 恢复大厅/房间/游戏状态',
      handler: (message) => {
        if (debug) {
          console.log('WebSocket: 收到重连同步消息', message)
        }
        
        if (message.code === 200 && message.data) {
          const payload = message.data as SystemReconnectPayload
          const myPlayerId = user?.userId ?? 0
          
          try {
            handleReconnectSync(payload, myPlayerId)
            if (debug) {
              console.log('WebSocket: 重连同步完成')
            }
          } catch (error) {
            console.error('WebSocket: 重连同步失败', error)
            onError?.('重连同步失败')
          }
        } else {
          console.warn('WebSocket: 重连同步消息异常', message)
        }
      }
    })

    return () => {
      unregisterHandler(MessageModule.SYSTEM, SystemCommand.RECONNECT)
    }
  }, [registerHandler, unregisterHandler, debug, onError])

  // 这个组件只负责消息监听，不渲染任何内容
  return null
}

export default WebSocketMessageListener