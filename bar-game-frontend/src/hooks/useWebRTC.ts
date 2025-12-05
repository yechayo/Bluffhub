import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCManager, type PeerConnection } from '../services/webRTCManager';
import { useWebSocketStore } from '../store/websocketStore';
import { useRoomStore } from '../store/roomStore';

/**
 * WebRTC Hook 状态接口
 */
export interface UseWebRTCState {
  isInitialized: boolean;
  isConnected: boolean;
  localStream: MediaStream | null;
  peers: PeerConnection[];
  error: string | null;
}

/**
 * WebRTC Hook 返回值接口
 */
export interface UseWebRTCReturn extends UseWebRTCState {
  initialize: (roomId: number) => Promise<boolean>;
  connectToUser: (userId: string) => Promise<void>;
  disconnectFromUser: (userId: string) => void;
  cleanup: () => void;
  manager: WebRTCManager | null;
}

/**
 * WebRTC Hook，用于在组件中管理 WebRTC 连接
 * @param onUserJoined 用户加入回调
 * @param onUserLeft 用户离开回调
 * @param onPeerConnected 对等连接建立回调
 * @param onPeerDisconnected 对等连接断开回调
 * @returns WebRTC 状态和控制函数
 */
export const useWebRTC = (
  onUserJoined?: (userId: string) => void,
  onUserLeft?: (userId: string) => void,
  onPeerConnected?: (userId: string) => void,
  onPeerDisconnected?: (userId: string) => void
): UseWebRTCReturn => {
  const managerRef = useRef<WebRTCManager | null>(null);
  const [state, setState] = useState<UseWebRTCState>({
    isInitialized: false,
    isConnected: false,
    localStream: null,
    peers: [],
    error: null
  });

  // 获取 WebSocket 连接状态
  const isConnected = useWebSocketStore(state => state.isConnected);
  // 获取当前房间ID（用于自动初始化）
  const currentRoomId = useRoomStore(state => state.currentRoom?.roomId);

  // 更新状态的辅助函数
  const updateState = useCallback((updates: Partial<UseWebRTCState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 使用 ref 存储回调函数，避免依赖变化
  const callbacksRef = useRef({
    onUserJoined,
    onUserLeft,
    onPeerConnected,
    onPeerDisconnected
  });
  
  // 更新回调 ref
  useEffect(() => {
    callbacksRef.current = {
      onUserJoined,
      onUserLeft,
      onPeerConnected,
      onPeerDisconnected
    };
  }, [onUserJoined, onUserLeft, onPeerConnected, onPeerDisconnected]);

  // 初始化 WebRTC
  const initialize = useCallback(async (roomId: number): Promise<boolean> => {
    if (!isConnected) {
      updateState({ error: 'WebSocket 未连接，无法初始化 WebRTC' });
      return false;
    }

    try {
      // 创建 WebRTC 管理器实例
      if (!managerRef.current) {
        managerRef.current = new WebRTCManager(
          (error: string) => updateState({ error }),
          callbacksRef.current.onPeerConnected,
          callbacksRef.current.onPeerDisconnected,
          () => {
            // peers 状态变化时更新
            if (managerRef.current) {
              updateState({ peers: managerRef.current.getPeers() });
            }
          }
        );
      }

      // 初始化 WebRTC 连接
      const success = await managerRef.current.initialize(roomId);
      
      if (success) {
        const localStream = managerRef.current?.getLocalStream() || null;
        updateState({
          isInitialized: true,
          localStream,
          error: null
        });
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '初始化 WebRTC 失败';
      updateState({ error: errorMessage });
      return false;
    }
  }, [isConnected, updateState]);

  // 连接到用户（若未初始化则先尝试自动初始化）
  const connectToUser = useCallback(async (userId: string): Promise<void> => {
    // 若尚未初始化，尝试使用当前房间ID初始化
    if (!state.isInitialized) {
      if (!currentRoomId) {
        updateState({ error: '当前无房间，无法初始化 WebRTC' });
        return;
      }
      const initOk = await initialize(currentRoomId);
      if (!initOk) {
        // 初始化失败已写入错误
        return;
      }
    }

    if (!managerRef.current) {
      updateState({ error: 'WebRTC 管理器未准备好' });
      return;
    }

    try {
      await managerRef.current.connectToUser(userId);
      updateState({
        peers: managerRef.current?.getPeers() || [],
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接用户失败';
      updateState({ error: errorMessage });
    }
  }, [state.isInitialized, updateState, initialize, currentRoomId]);

  // 断开与用户的连接
  const disconnectFromUser = useCallback((userId: string): void => {
    if (!managerRef.current) return;

    managerRef.current.disconnectFromUser(userId);
    updateState({ 
      peers: managerRef.current?.getPeers() || [],
      error: null 
    });
  }, [updateState]);

  // 清理资源
  const cleanup = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.cleanup();
      managerRef.current = null;
    }

    setState({
      isInitialized: false,
      isConnected: false,
      localStream: null,
      peers: [],
      error: null
    });
  }, []);

  // 监听 WebSocket 连接状态变化
  useEffect(() => {
    updateState({ isConnected });
  }, [isConnected, updateState]);

  // 组件卸载时清理资源
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    initialize,
    connectToUser,
    disconnectFromUser,
    cleanup,
    manager: managerRef.current
  };
};

export default useWebRTC;