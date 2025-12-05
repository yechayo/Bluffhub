import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../../store/authStore'

interface LogoutButtonProps {
  children?: React.ReactNode
  type?: 'primary' | 'default' | 'text' | 'link'
  size?: 'small' | 'middle' | 'large'
  className?: string
}

/**
 * 登出按钮组件
 */
const LogoutButton: React.FC<LogoutButtonProps> = ({
  children = '登出',
  type = 'primary',
  size = 'middle',
  className
}) => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const handleLogout = () => {
    // 清除认证状态
    logout()

    // 重定向到登录页
    navigate('/', { replace: true })
  }

  return (
    <Button
      type={type}
      size={size}
      className={className}
      onClick={handleLogout}
      danger
      style={{ textShadow: '1px 1px 2px #000000ff' }}
    >
      {children}
    </Button>
  )
}

export default LogoutButton