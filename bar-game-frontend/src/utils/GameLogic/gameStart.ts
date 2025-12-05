import useWebSocketStore from '../../store/websocketStore';
import { GameCommand, MessageModule, StatusCode } from '../../types/websocketMessages';
import type { StartGameRequest } from '../../types/websocketMessages';

const START_GAME_TIMEOUT = 3000;

/**
 * 通知后端开始游戏。
 * 后端会返回 code 为 200 的响应，表示开始成功；其它 code 视为失败。
 */
export async function startGame(roomId: number): Promise<void> {
  if (!Number.isFinite(roomId) || roomId <= 0) {
    throw new Error('房间ID无效');
  }

  const { sendMessage } = useWebSocketStore.getState();
  const payload: StartGameRequest = { roomId };

  try {
    const response = await sendMessage({
      module: MessageModule.GAME,
      cmd: GameCommand.START_GAME,
      code: StatusCode.SUCCESS,
      msg: 'start game',
      data: payload
    }, { timeout: START_GAME_TIMEOUT, expectResponse: true });

    if (response && response.code !== StatusCode.SUCCESS) {
      throw new Error(response.msg || '开始游戏失败');
    }
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.startsWith('请求超时')) {
      throw new Error('开始游戏请求超时');
    }
    throw error instanceof Error ? error : new Error('开始游戏失败');
  }
}
