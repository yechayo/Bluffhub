import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { handleReconnectRouteTarget, registerReconnectRouteCallback, unregisterReconnectRouteCallback, type ReconnectRouteTarget } from '../../../utils/reconnectSyncRoute.ts';
import useAuthStore from '../../../store/authStore';
import message from '../Message';

const ReconnectRouteGuard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAuthStore();

  useEffect(() => {
    registerReconnectRouteCallback((target: ReconnectRouteTarget) => {
      const path = handleReconnectRouteTarget(target, location.pathname);
      if (path && path !== location.pathname) {
        navigate(path, { replace: true });
      }
    });

    return () => {
      unregisterReconnectRouteCallback();
    };
  }, [navigate, location.pathname]);

  // 全局认证守卫：非登录页且未登录时，统一处理跳转
  useEffect(() => {
    if (isInitializing) return;

    // 允许停留在登录页
    if (location.pathname === '/') return;

    if (!isAuthenticated) {
      message.error('登录失败，3秒后自动跳转登录页');
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isInitializing, location.pathname, navigate]);

  return null;
};

export default ReconnectRouteGuard;
