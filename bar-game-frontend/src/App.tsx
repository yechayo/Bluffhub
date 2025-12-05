import './components/common/LoadingFrame/LoadingFrame.less'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect, Suspense } from 'react'
import Login from './pages/Login'
import './App.css'
import GameBar from './pages/GameBar'
import GameBarRoom from './pages/GameBarRoom'
import ReconnectRouteGuard from './components/common/ReconnectRouteGuard/ReconnectRouteGuard'
import WebSocketMessageListener from './components/common/WebSocketMessageListener/WebSocketMessageListener'
import { initializeAuth } from './store/authStore'
import GameStage2D from './components/GameStage2D/GameStage2D'
import TurnAround from './components/common/TurnAround/TurnAround'
import LoadingFrame from './components/common/LoadingFrame/LoadingFrame'

function App() {
  // 在应用启动时初始化认证状态
  useEffect(() => {
    initializeAuth()
  }, [])

  return (
    <Router>
      <TurnAround />
      {/* WebSocket消息监听器 - 全局组件，自动管理连接和消息处理 */}
      <WebSocketMessageListener
        debug={import.meta.env.DEV}
        onConnectionChange={(isConnected) => {
          console.log(`WebSocket连接状态: ${isConnected ? '已连接' : '已断开'}`)
        }}
        onError={(error) => {
          console.error('WebSocket错误:', error)
        }}
      />

        {/* 全局路由守卫：根据重连状态统一处理房间/游戏跳转 */}
        <ReconnectRouteGuard />

        <Suspense fallback={<LoadingFrame />}>
          <Routes>
            {/* 公共路由 - 登录页面 */}
            <Route path="/" element={<Login />} />
            <Route
              path="/2dtest"
              element={
                <GameStage2D />
              }
            />

            <Route path="/gamebar" element={<GameBar />} />

            <Route path="/room/:roomId" element={<GameBarRoom />}>
              <Route
                path="Gaming"
                element={<GameStage2D />}
              />
            </Route>
          </Routes>
        </Suspense>
    </Router>
  )
}

export default App