import { useState, useEffect } from 'react';
import { getRoomList } from '../utils/getRoomList';
import type { RoomListResponse, GetRoomListParams } from '../utils/getRoomList';
import { useAuthStore } from '../store/authStore';

/**
 * 获取房间列表的自定义Hook
 * @param autoLoad 是否在组件挂载时自动加载房间列表，默认为true
 * @returns 返回房间列表、加载状态、错误信息和重新加载函数
 */
export const useRoomList = (autoLoad: boolean = true) => {
  const [roomList, setRoomList] = useState<RoomListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();

  // 加载房间列表
  const loadRoomList = async (params?: GetRoomListParams) => {
    if (!isAuthenticated) {
      setError('用户未登录');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 默认参数
      const defaultParams: GetRoomListParams = {
        current: 1,
        size: 10,
      };
      
      const data = await getRoomList(params || defaultParams);
      setRoomList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取房间列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时自动加载房间列表
  useEffect(() => {
    if (autoLoad && isAuthenticated) {
      loadRoomList();
    }
  }, [autoLoad, isAuthenticated]);

  return {
    roomList,
    loading,
    error,
    loadRoomList,
    isAuthenticated
  };
};

export default useRoomList;