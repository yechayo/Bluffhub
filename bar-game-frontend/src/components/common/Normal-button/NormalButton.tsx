import React from 'react';
import './NormalButton.less';

interface NormalButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const NormalButton: React.FC<NormalButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}) => {
  const buttonClass = `
    normal-button
    normal-button--${variant}
    normal-button--${size}
    ${disabled ? 'normal-button--disabled' : ''}
    ${className}
  `.trim();

  return (
    <button
      className={buttonClass}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default NormalButton;