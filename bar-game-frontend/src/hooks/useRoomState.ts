import { useEffect, useCallback } from 'react';
import { useWebSocketStore } from '../store/websocketStore';
import { useRoomStore } from '../store/roomStore';
import { MessageModule, RoomCommand, type RoomMembersPushData } from '../types/websocketMessages';

/**
 * 房间状态Hook
 * 监听房间状态变化并更新roomStore
 */
export const useRoomState = () => {
  // 处理WebSocket推送的房间状态更新
  const handleRoomStateUpdate = useCallback((message: any) => {
    if (message.data) {
      const roomData = message.data as RoomMembersPushData;
      // 更新roomStore中的房间信息
      useRoomStore.getState().setCurrentRoom(roomData);
    }
  }, []);

  // 注册WebSocket消息处理器，监听服务器推送的房间状态更新
  useEffect(() => {
    const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
    
    // 注册ROOM_MEMBERS_PUSH消息处理器，处理服务器推送的房间成员更新
    registerHandler({
      module: MessageModule.ROOM,
      cmd: RoomCommand.ROOM_MEMBERS_PUSH,
      handler: handleRoomStateUpdate,
      description: '处理房间成员推送更新'
    });
    
    // 注册ROOM_UPDATE消息处理器，处理服务器推送的房间信息更新
    registerHandler({
      module: MessageModule.ROOM,
      cmd: RoomCommand.ROOM_UPDATE,
      handler: handleRoomStateUpdate,
      description: '处理房间信息更新'
    });
    
    // 注册PLAYER_JOIN消息处理器，处理玩家加入
    registerHandler({
      module: MessageModule.ROOM,
      cmd: RoomCommand.PLAYER_JOIN,
      handler: handleRoomStateUpdate,
      description: '处理玩家加入'
    });
    
    // 注册PLAYER_LEAVE消息处理器，处理玩家离开
    registerHandler({
      module: MessageModule.ROOM,
      cmd: RoomCommand.PLAYER_LEAVE,
      handler: handleRoomStateUpdate,
      description: '处理玩家离开'
    });
    
    // 注册PLAYER_PREPARE消息处理器，处理玩家准备状态变化
    registerHandler({
      module: MessageModule.ROOM,
      cmd: RoomCommand.PLAYER_PREPARE,
      handler: handleRoomStateUpdate,
      description: '处理玩家准备状态变化'
    });
    
    return () => {
      // 组件卸载时注销WebSocket消息处理器
      unregisterHandler(MessageModule.ROOM, RoomCommand.ROOM_MEMBERS_PUSH);
      unregisterHandler(MessageModule.ROOM, RoomCommand.ROOM_UPDATE);
      unregisterHandler(MessageModule.ROOM, RoomCommand.PLAYER_JOIN);
      unregisterHandler(MessageModule.ROOM, RoomCommand.PLAYER_LEAVE);
      unregisterHandler(MessageModule.ROOM, RoomCommand.PLAYER_PREPARE);
    };
  }, [handleRoomStateUpdate]);

  // 这个hook不需要返回任何值，因为它只是负责监听和更新store
  return null;
};

export default useRoomState;