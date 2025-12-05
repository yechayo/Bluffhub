import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useMobile from '../../../hooks/useMobile';
import './TurnAround.less';

const TurnAround: React.FC = () => {
  const isMobile = useMobile();
  const [isPortrait, setIsPortrait] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkOrientation = () => {
      // 判断是否竖屏：高度大于宽度
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    // 初始化检查
    checkOrientation();

    // 监听 resize 和 orientationchange 事件
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // 如果是登录页，不显示
  if (location.pathname === '/') {
    return null;
  }

  // 只有在移动端且竖屏时才显示
  if (!isMobile || !isPortrait) {
    return null;
  }

  return (
    <div className="turn-around-overlay">
      <div className="phone-icon"></div>
      <div className="message">
        <div>请旋转手机</div>
        <p>为了获得最佳游戏体验，请使用横屏模式</p>
      </div>
    </div>
  );
};

export default TurnAround;
