import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import "./Login.less"
import NormalButton from "../components/common/Normal-button"
import MessageListener from "../components/common/MessageListener/MessageListener"
import message from "../components/common/Message"
import Background from "../components/common/BackGround/Background"
import useAuthStore from "../store/authStore"
import StartFont from "../components/3d-components/StartFont/StartFomt.js"
import { LOGIN_IFRAME_CONFIG } from "../config"



const Login = () => {
  const [islogin, setislogin] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const loginIframeUrl = useMemo(() => LOGIN_IFRAME_CONFIG.IFRAME_URL, [])

  function handleclose() {
    if (isClosing) return; // 防止重复点击
    setIsClosing(true)
    // 等待动画完成后关闭
    setTimeout(() => {
      setislogin(0)
      setIsClosing(false)
      setIsStarting(false)
      setIframeLoaded(false)
    }, 500)
  }

  // 处理登录成功
  const handleLoginSuccess = (token: string) => {
    // 添加淡出动画
    console.log(token)
    setIsClosing(true);
    setTimeout(() => {
      setislogin(0);
      setIsClosing(false);
    }, 300);

    // 显示成功提示并跳转
    setTimeout(() => {
      message.success("登录成功！");
      navigate('/gamebar');
    }, 500);
  }

  // 处理注册成功
  const handleRegisterSuccess = (token: string) => {
    // 添加淡出动画
    console.log(token)
    setIsClosing(true);
    setTimeout(() => {
      setislogin(0);
      setIsClosing(false);
    }, 300);

    // 显示成功提示并跳转
    setTimeout(() => {
      message.success("注册成功！");
      navigate('/gamebar');
    }, 350);
  }

  // 处理登录错误
  const handleLoginError = (error: string) => {
    message.error(error);
  }

  // 处理注册错误
  const handleRegisterError = (error: string) => {
    message.error(error);
  }

  // 处理点击任意位置继续
  const handleClickToContinue = () => {
    if (isStarting) return; // 防止重复点击
    setIsStarting(true);

    if (token) {
      // 如果有token，直接跳转到游戏大厅
      setTimeout(() => {
        navigate('/gamebar');
      }, 1000);
    } else {
      setIframeLoaded(false);
      // 延迟1秒后设置iframe透明度为1
      setTimeout(() => {
        setIframeLoaded(true);
      }, 500);
      // 没有token，显示登录界面
      setTimeout(() => {
        setislogin(1);

      }, 0);
    }
  };

  return (
    <div className="login-container">
      {/* 消息监听组件 */}
      <Background />
      <MessageListener
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleRegisterSuccess}
        onLoginError={handleLoginError}
        onRegisterError={handleRegisterError}
      />

      {islogin === 1 && <div className={`login-iframe-container ${isClosing ? 'fade-out' : ''}`} >
        <iframe
          src={loginIframeUrl}
          title="登录页面"
          style={{ opacity: iframeLoaded && !isClosing ? 1 : 0 }}
        />
        <NormalButton onClick={handleclose} className={`close-button ${iframeLoaded && !isClosing ? 'visible' : 'hidden'}`}>X</NormalButton>
      </div>
      }
      {
        islogin === 2 && <div className={`login-iframe-container ${isClosing ? 'fade-out' : ''}`}>
          <div>游客</div>
          <NormalButton onClick={handleclose} className="close-button">X</NormalButton>
        </div>
      }{(islogin === 0 || islogin === 1 )&& (!iframeLoaded) &&
        <div className="login-overlay" onClick={handleClickToContinue}>
          {/* <div className="login-hint">点击任意位置继续</div> */}
          <StartFont text="点击任意位置继续" className={isStarting ? 'fade-up' : ''} />
        </div>
      }
    </div>
  )
}

export default Login