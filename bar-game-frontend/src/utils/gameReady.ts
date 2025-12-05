import useWebSocketStore from '../store/websocketStore';
import { StatusCode, RoomCommand, MessageModule } from '../types/websocketMessages';

/**
 * 发送玩家准备消息
 * 服务器根据当前连接上下文识别玩家与房间，无需附加 data。
 */
export async function playerPrepare() {
  try {
    const response = await useWebSocketStore.getState().sendMessage({
      module: MessageModule.ROOM,
      cmd: RoomCommand.PLAYER_PREPARE,
      code: StatusCode.SUCCESS,
      msg: 'player prepare'
    }, { expectResponse: true });
    return response;
  } catch (err) {
    throw err;
  }
}

/**
 * 发送玩家取消准备消息
 */
export async function playerCancelPrepare() {
  try {
    const response = await useWebSocketStore.getState().sendMessage({
      module: MessageModule.ROOM,
      cmd: RoomCommand.PLAYER_CANCEL_PREPARE,
      code: StatusCode.SUCCESS,
      msg: 'player cancel prepare'
    }, { expectResponse: true });
    return response;
  } catch (err) {
    throw err;
  }
}
