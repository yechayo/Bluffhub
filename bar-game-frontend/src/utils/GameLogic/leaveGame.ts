import { useWebSocketStore } from '../../store/websocketStore';
import { MessageModule, GameCommand, type LeaveGameRequest, StatusCode } from '../../types/websocketMessages';

/**
 * 玩家离开游戏
 * @param gameId 游戏ID
 */
export const leaveGame = async (gameId: number): Promise<void> => {
  const { sendMessage } = useWebSocketStore.getState();
  
  const requestData: LeaveGameRequest = {
    gameId
  };

  await sendMessage({
    module: MessageModule.GAME,
    cmd: GameCommand.LEAVE_GAME,
    code: StatusCode.SUCCESS,
    msg: 'leave game',
    data: requestData
  });
};
