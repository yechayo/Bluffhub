import { MessageModule, GameCommand, type GameStartedData } from '../../types/websocketMessages';
import { useWebSocketStore } from '../../store/websocketStore';

/**
 * 注册游戏开始通知处理器 (GAME:GAME_STARTED)
 * 该消息在 PLAYER_SEATS 广播后发送，包含当前玩家的私有信息（如手牌）
 * 返回一个用于注销的函数。
 */
export function registerGameStartedHandler(callback: (data: GameStartedData) => void) {
  const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
  registerHandler({
    module: MessageModule.GAME,
    cmd: GameCommand.GAME_STARTED,
    handler: (message) => {
      const data = message.data as GameStartedData;
      if (data && data.gameId && data.gamePlayers) {
        callback(data);
      }
    },
    description: '游戏开始通知（包含玩家手牌等私有信息）'
  });
  return () => unregisterHandler(MessageModule.GAME, GameCommand.GAME_STARTED);
}

export default registerGameStartedHandler;
