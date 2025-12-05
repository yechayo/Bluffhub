import { MessageModule, GameCommand, type PlayerSeatsData } from '../../types/websocketMessages';
import { useWebSocketStore } from '../../store/websocketStore';

/**
 * 注册玩家座位布局广播处理器 (GAME:PLAYER_SEATS)
 * 返回一个用于注销的函数。
 */
export function registerPlayerSeatsHandler(callback: (data: PlayerSeatsData) => void) {
  const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
  registerHandler({
    module: MessageModule.GAME,
    cmd: GameCommand.PLAYER_SEATS,
    handler: (message) => {
      const data = message.data as PlayerSeatsData;
      if (data && Array.isArray(data.playerIds)) {
        callback(data);
      }
    },
    description: '玩家座位布局广播'
  });
  return () => unregisterHandler(MessageModule.GAME, GameCommand.PLAYER_SEATS);
}

export default registerPlayerSeatsHandler;
