import { useState, useEffect, useCallback } from 'react';
import HallService from '../services/hallService';
import type { OnlineUser, OnlineListResponse } from '../services/hallService';
import { useWebSocketStore } from '../store/websocketStore';
import { MessageModule } from '../types/websocketMessages';
import { registerOnlineUsersCallback, unregisterOnlineUsersCallback } from '../utils/reconnectSync';

/**
 * 在线用户列表Hook
 * 管理在线用户列表的获取和状态
 */
export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取在线用户列表
   */
  const fetchOnlineUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response: OnlineListResponse = await HallService.getOnlineUsers();
      setOnlineUsers(response.onlineUsers);
      setOnlineCount(response.onlineCount);
    } catch (err: any) {
      setError(err.message || '获取在线用户列表失败');
      console.error('获取在线用户列表错误:', err);
    } finally {
      setLoading(false);
    }
  };

  // 处理WebSocket推送的在线用户列表更新
  const handleOnlineUsersUpdate = useCallback((message: any) => {
    if (message.data) {
      setOnlineUsers(message.data.onlineUsers || []);
      setOnlineCount(message.data.onlineCount || 0);
    }
  }, []);

  // 处理重连同步回调 - 直接设置在线用户数据
  const handleReconnectUpdate = useCallback((data: { onlineCount: number; onlineUsers: any[] }) => {
    setOnlineUsers(data.onlineUsers || []);
    setOnlineCount(data.onlineCount || 0);
  }, []);

  // 组件挂载时自动获取在线用户列表并注册WebSocket监听
  useEffect(() => {
    // 注册WebSocket消息处理器，监听服务器推送的在线用户列表更新
    const { registerHandler, unregisterHandler, isConnected } = useWebSocketStore.getState();
    
    // 注册ONLINE_LIST消息处理器，处理服务器响应的在线用户列表
    registerHandler({
      module: MessageModule.HALL,
      cmd: 'ONLINE_LIST',
      handler: handleOnlineUsersUpdate,
      description: '处理在线用户列表响应'
    });
    
    // 注册ONLINE_LIST_UPDATE消息处理器，处理服务器推送的在线用户列表更新
    registerHandler({
      module: MessageModule.HALL,
      cmd: 'ONLINE_LIST_UPDATE',
      handler: handleOnlineUsersUpdate,
      description: '处理在线用户列表更新'
    });

    // 注册重连同步回调
    registerOnlineUsersCallback(handleReconnectUpdate);
    
    // 只有在WebSocket已连接时才获取在线用户列表
    if (isConnected) {
      fetchOnlineUsers();
    }
    

    
    // 设置定时检查连接状态并获取数据
    const connectionCheckInterval = setInterval(() => {
      const { isConnected } = useWebSocketStore.getState();
      if (isConnected) {
        fetchOnlineUsers();
        clearInterval(connectionCheckInterval); // 获取成功后清除检查定时器
      }
    }, 1000); // 每秒检查一次连接状态
    
    // 可以设置定时刷新，例如每30秒刷新一次
    const intervalId = setInterval(() => {
      const { isConnected } = useWebSocketStore.getState();
      if (isConnected) {
        fetchOnlineUsers();
      }
    }, 30000);
    
    return () => {
      clearInterval(intervalId);
      clearInterval(connectionCheckInterval);
      // 组件卸载时注销WebSocket消息处理器
      unregisterHandler(MessageModule.HALL, 'ONLINE_LIST');
      unregisterHandler(MessageModule.HALL, 'ONLINE_LIST_UPDATE');
      // 注销重连同步回调
      unregisterOnlineUsersCallback();
    };
  }, [handleOnlineUsersUpdate, handleReconnectUpdate]);

  return {
    onlineUsers,
    onlineCount,
    loading,
    error,
    refetch: fetchOnlineUsers
  };
};

export default useOnlineUsers;