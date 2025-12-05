import { useState, useRef, useCallback, useEffect, type MouseEvent, type ButtonHTMLAttributes } from 'react';
import './index.less';

interface DebouncedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 防抖延迟时间（毫秒），默认 500ms */
  debounceDelay?: number;
  /** 点击回调 */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  /** 是否在执行中禁用按钮，默认 true */
  disableOnExecuting?: boolean;
}

/**
 * 防抖按钮组件
 * 防止用户快速重复点击，支持异步操作
 */
export default function DebouncedButton({
  debounceDelay = 500,
  onClick,
  disableOnExecuting = true,
  disabled,
  className = '',
  children,
  ...restProps
}: DebouncedButtonProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  const handleClick = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      const now = Date.now();
      
      // 防抖：如果距离上次点击时间太短，忽略本次点击
      if (now - lastClickTimeRef.current < debounceDelay) {
        return;
      }
      
      lastClickTimeRef.current = now;
      
      // 清除之前的定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (!onClick) return;

      try {
        setIsExecuting(true);
        const result = onClick(event);
        
        // 如果返回 Promise，等待其完成
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        console.error('DebouncedButton onClick error:', error);
      } finally {
        // 使用定时器延迟重置状态，确保至少有 debounceDelay 的冷却时间
        timerRef.current = setTimeout(() => {
          setIsExecuting(false);
        }, debounceDelay);
      }
    },
    [onClick, debounceDelay]
  );

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const isDisabled = disabled || (disableOnExecuting && isExecuting);

  return (
    <button
      {...restProps}
      className={`debounced-button ${className} ${isExecuting ? 'executing' : ''}`}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
