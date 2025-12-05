import './App.css'
import Login from './components/login'
import MobileLogin from './components/mobileLogin'
import { config } from './config'
import bg from "./assets/屏幕截图 2025-11-24 172718.png"
import useMobile from './hooks/useMobile'
// 在开发环境下输出配置信息，便于调试
if (config.enableLogging) {
  console.log('应用配置:', config)
}

function App() {
  const isMobile = useMobile();

  return (
    <>
      <img src={bg} alt="Background" className="video"></img>
      <div className="video-overlay"></div>
      {
        isMobile ? (
          <MobileLogin />
        ) : (
          <Login />
        )
      }
    </>
  )
}

export default App
