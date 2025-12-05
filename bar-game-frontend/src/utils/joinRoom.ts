import { useWebSocketStore } from '../store/websocketStore';
import { useRoomStore } from '../store/roomStore';
import { MessageModule, StatusCode, RoomCommand, type RoomJoinRequest, type RoomJoinResponse } from '../types/websocketMessages';

/**
 * 加入房间WebSocket请求
 * @param roomId 房间ID
 * @returns Promise<RoomJoinResponse> 服务器响应
 */
export const joinRoom = async (roomId: number): Promise<RoomJoinResponse> => {
  const { sendMessage } = useWebSocketStore.getState();
  
  try {
    const response = await sendMessage({
      module: MessageModule.ROOM,
      cmd: RoomCommand.ROOM_JOIN,
      code: StatusCode.SUCCESS,
      msg: 'success',
      data: {
        roomId
      } as RoomJoinRequest
    });
    
    const roomData = response.data as RoomJoinResponse;
    
    // 将房间数据存储到store中
    useRoomStore.getState().setCurrentRoom(roomData);
    
    return roomData;
  } catch (error) {
    console.error('加入房间失败:', error);
    throw error;
  }
};

/**
 * 加入房间请求参数接口
 */
export interface JoinRoomParams extends RoomJoinRequest {
  roomId: number;
}

/**
 * 加入房间响应接口
 */
export type JoinRoomResponse = RoomJoinResponse;

export default joinRoom;