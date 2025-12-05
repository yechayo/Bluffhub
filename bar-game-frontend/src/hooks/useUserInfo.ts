import { useState, useEffect, useCallback } from 'react';
import { getUserInfo }  from '../utils/getUserInfo';
import type { UserInfoResponse } from '../utils/getUserInfo';
import { useAuthStore } from '../store/authStore';

/**
 * 获取用户信息的自定义Hook
 * @param autoLoad 是否在组件挂载时自动加载用户信息，默认为true
 * @returns 返回用户信息、加载状态、错误信息和重新加载函数
 */
export const useUserInfo = (autoLoad: boolean = true) => {
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isInitializing } = useAuthStore();

  // 加载用户信息
  const loadUserInfo = useCallback(async () => {
    // 初始化阶段不主动报未登录错误，等待初始化完成
    if (isInitializing) {
      return;
    }

    if (!isAuthenticated) {
      setError('用户未登录');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getUserInfo();
      setUserInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取用户信息失败');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isInitializing]);

  // 组件挂载时自动加载用户信息
  useEffect(() => {
    if (autoLoad && isAuthenticated && !isInitializing) {
      loadUserInfo();
    }
  }, [autoLoad, isAuthenticated, isInitializing, loadUserInfo]);

  return {
    userInfo,
    loading,
    error,
    loadUserInfo,
    isAuthenticated,
    isInitializing
  };
};

export default useUserInfo;