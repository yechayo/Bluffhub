import { useGameStore } from '../../store/gameStore';
import { useWebSocketStore } from '../../store/websocketStore';
import { MessageModule, GameCommand, type GameLeaveData } from '../../types/websocketMessages';
import { message } from 'antd';

/**
 * 处理玩家离开游戏广播
 * @param data 广播数据
 */
export const handleGameLeave = (data: GameLeaveData) => {
  const { gameId, leavePlayerId, roundNumber } = data;
  const currentGameId = useGameStore.getState().gameId;

  // 校验游戏ID是否匹配
  if (currentGameId !== gameId) {
    console.warn(`收到不匹配的离开游戏通知: current=${currentGameId}, received=${gameId}`);
    return;
  }

  console.log(`玩家 ${leavePlayerId} 离开游戏，标记为死亡`);

  // 更新玩家存活状态为 false (死亡)
  useGameStore.getState().setPlayerAlive(leavePlayerId, false);
  
  // 更新轮次信息 (虽然通常会有 NEW_ROUND 跟随，但这里也更新一下以防万一)
  useGameStore.getState().setRoundNumber(roundNumber);

  message.info(`玩家 ${leavePlayerId} 已离开游戏`);
};

/**
 * 注册玩家离开游戏通知处理器 (GAME:GAME_LEAVE)
 * 返回一个用于注销的函数。
 * @param callback 可选的回调函数，在处理完默认逻辑后调用
 */
export function registerGameLeaveHandler(callback?: (data: GameLeaveData) => void) {
  const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
  registerHandler({
    module: MessageModule.GAME,
    cmd: GameCommand.GAME_LEAVE,
    handler: (message) => {
      const data = message.data as GameLeaveData;
      if (data && data.gameId) {
        handleGameLeave(data);
        if (callback) {
          callback(data);
        }
      }
    },
    description: '玩家离开游戏通知'
  });
  return () => unregisterHandler(MessageModule.GAME, GameCommand.GAME_LEAVE);
}
