import React from 'react';
import RevolverCylinder from '../RevolverCylinder/RevolverCylinder';
import './PlayerArea.less';

interface PlayerAreaProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  name: string;
  avatar?: string;
  seatIndex?: number;
  isSelf?: boolean;
  cardCount?: number;
  dead?: boolean;
  bulletsLeft?: number;
  isShootingTarget?: boolean;
}

const PlayerArea: React.FC<PlayerAreaProps> = ({ 
  position, 
  name, 
  avatar, 
  seatIndex, 
  isSelf, 
  cardCount = 0, 
  dead = false,
  bulletsLeft = 6,
  isShootingTarget = false
}) => {
  return (
    <div className={`player-area position-${position} ${isSelf ? 'is-self' : ''}`}>
      <div className={`avatar-circle ${dead ? 'dead' : ''}`}>
        {avatar ? (
          <img src={avatar} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
        ) : (
          name.charAt(0)
        )}

        {dead && (
          <>
            <div className="dead-badge" aria-hidden>☠</div>
            <div className="blood-overlay" />
          </>
        )}
        
        {isShootingTarget && (
          <div className="shooting-effect">
            <div className="muzzle-flash" />
            <div className="gun-barrel" />
            <div className="smoke-puff" />
          </div>
        )}
      </div>
      
      <div className="player-info">
        <span className="player-name">
          {name}
          {seatIndex !== undefined && <span className="seat-badge"> [座位{seatIndex}]</span>}
        </span>
        <div className="player-status">
          <RevolverCylinder bulletsLeft={bulletsLeft} />
        </div>
      </div>
      
      {/* 显示手牌背面（仅对非自己玩家显示，或者都显示但自己有HandCards组件覆盖） */}
      {!isSelf && cardCount > 0 && (
        <div className="player-hand-count">
          <div className="card-stack">
            {/* 只渲染最多5张作为示意，或者显示数字 */}
            {Array.from({ length: Math.min(cardCount, 5) }).map((_, i) => (
              <div 
                key={i} 
                className="mini-card-back" 
                style={{ 
                  transform: `translateX(${i * 4}px) translateY(${i * -2}px) rotate(${i * 2}deg)`,
                  zIndex: i
                }}
              />
            ))}
            <div className="card-count-badge">{cardCount}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerArea;
