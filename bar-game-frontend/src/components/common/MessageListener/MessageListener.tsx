import { useEffect, useCallback, useMemo } from "react"
import useAuthStore from "../../../store/authStore"
import type { User } from "../../../store/authStore"
import { LOGIN_IFRAME_CONFIG } from "../../../config"

interface MessageListenerProps {
  onLoginSuccess?: (token: string) => void
  onRegisterSuccess?: (token: string) => void
  onLoginError?: (error: string) => void
  onRegisterError?: (error: string) => void
  onClose?: () => void
  allowedOrigin?: string
  allowedOrigins?: string[]
}

/**
 * 消息监听组件，用于处理来自iframe登录页面的消息
 */
const MessageListener = ({
  onLoginSuccess,
  onRegisterSuccess,
  onLoginError,
  onRegisterError,
  allowedOrigin,
  allowedOrigins,
}: MessageListenerProps) => {
  const { login, setToken } = useAuthStore()
  const originWhiteList = useMemo(() => {
    if (allowedOrigins && allowedOrigins.length > 0) {
      return allowedOrigins;
    }
    if (allowedOrigin) {
      return [allowedOrigin]
    }
    return LOGIN_IFRAME_CONFIG.ALLOWED_ORIGINS
  }, [allowedOrigin, allowedOrigins])

  const handleMessage = useCallback((event: MessageEvent) => {
    // 验证消息来源以确保安全
    if (
      originWhiteList.length > 0 &&
      !originWhiteList.includes(event.origin)
    ) {
      return;
    }

    // 处理登录成功的消息
    if (event.data && typeof event.data === 'object') {
      switch (event.data.type) {
        case 'LOGIN_SUCCESS':
          if (event.data.token && typeof event.data.token === 'string') {
            console.log("收到登录token:", event.data.token);

            // 更新认证状态管理
            setToken(event.data.token);

            // 处理新的登录返回格式，包含username字段
            if (event.data.username) {
              const now = new Date().toISOString();
              const user: User = {
                userId: 0,
                username: event.data.username,
                sessionId: null,
                playerStatus: '',
                locationType: '',
                playerRole: null,
                seatNumber: 0,
                isOwner: false,
                isReady: false,
                connectionStatus: '',
                isAlive: null,
                score: null,
                winCount: null,
                loseCount: null,
                handCards: null,
                actionHistory: null,
                playerData: null,
                lastActiveTime: now,
                joinTime: now,
                lastActionTime: null,
                tempFlag: null,
                createdAt: null,
                updatedAt: null,
                alive: false,
                prepared: false,
                statusDescription: '',
                online: true,
                roomId: null,
                nickName: event.data.username,
                locationDescription: '',
                inLobby: true,
                inGame: false,
                timeout: false,
                roomOwner: false,
                winRate: 0,
                inRoom: false,
                roleModelInfo: null
              };
              login(event.data.token, user);
            } else if (event.data.user) {
              // 兼容旧的用户信息格式
              const user: User = {
                id: event.data.user.id || '',
                username: event.data.user.username || '',
                ...event.data.user // 支持任意额外字段
              };
              login(event.data.token, user);
            } else {
              login(event.data.token);
            }

            // 调用登录成功回调
            onLoginSuccess?.(event.data.token);
          }
          break;

        case 'REGISTER_SUCCESS':
          if (event.data.token && typeof event.data.token === 'string') {
            console.log("收到注册token:", event.data.token);

            // 更新认证状态管理
            setToken(event.data.token);
            login(event.data.token);

            // 调用注册成功回调
            onRegisterSuccess?.(event.data.token);
          }
          break;

        case 'LOGIN_ERROR':
          if (event.data.error && typeof event.data.error === 'string') {
            console.log("收到登录错误:", event.data.error);
            // 调用登录错误回调
            onLoginError?.(event.data.error);
          }
          break;

        case 'REGISTER_ERROR':
          if (event.data.error && typeof event.data.error === 'string') {
            console.log("收到注册错误:", event.data.error);
            // 调用注册错误回调
            onRegisterError?.(event.data.error);
          }
          break;

        default:
          // 处理其他类型消息（向后兼容）
          if (typeof event.data === 'string' && event.data.length > 0) {
            console.log("收到登录token（兼容模式）:", event.data);

            // 更新认证状态管理
            setToken(event.data);
            login(event.data);

            // 调用登录成功回调
            onLoginSuccess?.(event.data);
          }
          break;
      }
    }
  }, [originWhiteList, onLoginSuccess, onLoginError, onRegisterError, login, setToken]);

  useEffect(() => {
    // 添加事件监听器
    window.addEventListener("message", handleMessage);

    // 清理函数：组件卸载时移除事件监听器
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleMessage]);

  // 这个组件只是用于监听消息，不渲染任何内容
  return null;
}

export default MessageListener;