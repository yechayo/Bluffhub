import React from 'react';
import './LoadingAnimation.css';

interface LoadingAnimationProps {
  text?: string;
  color?: string;
  fontSize?: number;
  className?: string;
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ 
  text = '加载中...', 
  color = '#ffffffff', 
  fontSize = 18,
  className = '' 
}) => {
  const chars = text.split('');
  
  return (
    <div className={`loading-animation-container ${className}`}>
      {chars.map((char, index) => (
        <span
          key={index}
          className="loading-char"
          style={{
            color,
            fontSize: `${fontSize}px`,
            animationDelay: `${index * 0.15}s`
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
};

export default LoadingAnimation;