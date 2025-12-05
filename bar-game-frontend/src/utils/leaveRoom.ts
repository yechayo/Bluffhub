import { useWebSocketStore } from '../store/websocketStore';
import { MessageModule, StatusCode, RoomCommand, type RoomLeaveRequest, type RoomLeaveResponse } from '../types/websocketMessages';

/**
 * 退出房间WebSocket请求
 * @param roomId 房间ID
 * @returns Promise<RoomLeaveResponse> 服务器响应
 */
export const leaveRoom = async (roomId: number): Promise<RoomLeaveResponse> => {
  const { sendMessage } = useWebSocketStore.getState();
  
  try {
    const response = await sendMessage({
      module: MessageModule.ROOM,
      cmd: RoomCommand.ROOM_LEAVE,
      code: StatusCode.SUCCESS,
      msg: '退出房间',
      data: {
        roomId
      } as RoomLeaveRequest
    });
    
    return response.data as RoomLeaveResponse;
  } catch (error) {
    console.error('退出房间失败:', error);
    throw error;
  }
};

/**
 * 退出房间请求参数接口
 */
export interface LeaveRoomParams extends RoomLeaveRequest {
  roomId: number;
}

/**
 * 退出房间响应接口
 */
export type LeaveRoomResponse = RoomLeaveResponse;

export default leaveRoom;