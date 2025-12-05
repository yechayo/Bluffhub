import { useState, useEffect } from 'react';

/**
 * 检测设备是否为移动端的Hook
 * @returns boolean - true表示移动端，false表示桌面端
 */
export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // 检测函数
    const checkIsMobile = () => {
      // 方法1: User Agent检测（最常用）
      const userAgent = navigator.userAgent || (window as any).opera;

      // 移动设备特征标识
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

      // 方法2: 触摸支持检测
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // 方法3: 屏幕宽度检测（768px以下是移动端）
      const hasSmallScreen = window.innerWidth <= 768;

      // 方法4: 基于像素比和DPI检测（高DPI通常是移动设备）
      const hasHighDPI = window.devicePixelRatio > 1 && window.innerWidth <= 1024;

      // 综合判断：User Agent匹配或满足移动端特征则认为是移动端
      const isMobileDevice = mobileRegex.test(userAgent) ||
                            (hasTouch && hasSmallScreen) ||
                            hasHighDPI;

      return isMobileDevice;
    };

    // 初始化检测
    setIsMobile(checkIsMobile());

    // 监听窗口大小变化（响应式适配）
    const handleResize = () => {
      setIsMobile(checkIsMobile());
    };

    // 添加监听器
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isMobile;
}

export default useMobile;
