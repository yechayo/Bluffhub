import React, { useEffect, useState } from 'react';
import './YourTurnIndicator.less';

interface YourTurnIndicatorProps {
  isMyTurn: boolean;
}

const YourTurnIndicator: React.FC<YourTurnIndicatorProps> = ({ isMyTurn }) => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (isMyTurn) {
      setShowBanner(true);
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 2500); // 2.5秒后隐藏大文字
      return () => clearTimeout(timer);
    } else {
      setShowBanner(false);
    }
  }, [isMyTurn]);

  if (!isMyTurn) return null;

  return (
    <div className="your-turn-container">
      {/* 持续的屏幕边缘光效 */}
      <div className="screen-glow" />
      
      {/* 瞬时的大文字提示 */}
      {showBanner && (
        <div className="turn-banner">
          <div className="turn-text">YOUR TURN</div>
          <div className="turn-line" />
        </div>
      )}
    </div>
  );
};

export default YourTurnIndicator;
