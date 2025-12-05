import { MessageModule, GameCommand, type NewRoundData } from '../../types/websocketMessages';
import { useWebSocketStore } from '../../store/websocketStore';

/**
 * 注册新一轮开始通知处理器 (GAME:NEW_ROUND)
 * 质疑后如果游戏继续，会开启新一轮并为每个玩家发送个性化通知
 * 返回一个用于注销的函数。
 */
export function registerNewRoundHandler(callback: (data: NewRoundData) => void) {
  const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
  registerHandler({
    module: MessageModule.GAME,
    cmd: GameCommand.NEW_ROUND,
    handler: (message) => {
      const data = message.data as NewRoundData;
      if (data && data.gameId && data.gamePlayers) {
        callback(data);
      }
    },
    description: '新一轮开始通知（包含玩家手牌等私有信息）'
  });
  return () => unregisterHandler(MessageModule.GAME, GameCommand.NEW_ROUND);
}

export default registerNewRoundHandler;
