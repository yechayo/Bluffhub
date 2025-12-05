import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore, initializeAuth } from '../../../store/authStore'
import './RouteGuard.css'

interface RouteGuardProps {
  children: React.ReactNode
  requireAuth?: boolean // 是否需要认证，默认true
  redirectTo?: string // 重定向路径，默认'/'
}

/**
 * 路由守护组件
 * 根据认证状态控制路由访问
 */
const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  requireAuth = true,
  redirectTo = '/'
}) => {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  const { isAuthenticated, token } = useAuthStore()

  // 初始化认证状态
  useEffect(() => {
    const init = () => {
      try {
        // 初始化认证状态
        initializeAuth()
        setIsInitialized(true)
      } catch (error) {
        console.error('认证初始化失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  // token处理完成
  useEffect(() => {
    if (isInitialized && token) {
      // token存在，不做验证，相信后端token是有效的
      console.log('Token已加载')
    }
  }, [token, isInitialized])

  // 加载状态
  if (isLoading) {
    return (
      <div className="route-guard-loading">
        <div className="loading-content">
          <Spin size="large" />
          <p>正在验证身份...</p>
        </div>
      </div>
    )
  }

  // 需要认证但未认证
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // 通过检查，渲染子组件
  return <>{children}</>
}

export default RouteGuard