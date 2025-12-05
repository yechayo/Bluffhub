import { MessageModule, GameCommand, type GameFinishedData } from '../../types/websocketMessages';
import { useWebSocketStore } from '../../store/websocketStore';

/**
 * 注册游戏结束通知处理器 (GAME:GAME_FINISHED)
 * 当游戏结束时，服务器会向所有玩家推送游戏结束通知
 * 返回一个用于注销的函数。
 */
export function registerGameFinishedHandler(callback: (data: GameFinishedData) => void) {
  const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
  registerHandler({
    module: MessageModule.GAME,
    cmd: GameCommand.GAME_FINISHED,
    handler: (message) => {
      const data = message.data as GameFinishedData;
      if (data && data.gameId) {
        callback(data);
      }
    },
    description: '游戏结束通知'
  });
  return () => unregisterHandler(MessageModule.GAME, GameCommand.GAME_FINISHED);
}

export default registerGameFinishedHandler;
