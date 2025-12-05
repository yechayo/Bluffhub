import { MessageModule, GameCommand, type ChallengeRequest, type ChallengeResultData } from '../../types/websocketMessages';
import { useWebSocketStore } from '../../store/websocketStore';
import { useGameStore } from '../../store/gameStore';

/**
 * 发送质疑请求
 * 规则：只能在自己回合质疑，不能质疑自己出的牌（调用方需保证）
 */
export async function challenge(gameId: number): Promise<void> {
  const { sendMessage } = useWebSocketStore.getState();

  if (!gameId) {
    throw new Error('gameId 不能为空');
  }

  const req: ChallengeRequest = { gameId };

  try {
    const resp = await sendMessage({
      module: MessageModule.GAME,
      cmd: GameCommand.CHALLENGE,
      code: 200,
      msg: 'challenge',
      data: req
    }, { expectResponse: true, timeout: 5000 });

    if (resp.code !== 200) {
      throw new Error(resp.msg || '质疑请求失败');
    }

    // 服务器可能直接在响应中包含结果（视后端实现），因此也尝试处理
    try {
      const data = resp.data as ChallengeResultData | undefined;
      if (data && typeof data.gameId === 'number') {
        handleChallengeResultLocally(data);
      }
    } catch (e) {
      console.warn('解析质疑响应时失败', e);
    }
  } catch (error) {
    console.error('质疑失败:', error);
    throw error;
  }
}

/**
 * 内部处理质疑结果到本地 store
 */
function handleChallengeResultLocally(data: ChallengeResultData) {
  const {
    setRoundNumber,
    setCurrentTurnPlayerId,
    updatePlayerCardCount,
    setLastPlayedAction,
    setMyGamePlayer,
    myGamePlayer,
    setPlayerAlive,
    playersBulletsLeft,
    setPlayerBullets,
    setChallengeReveal
  } = useGameStore.getState();

  if (typeof data.roundNumber === 'number') {
    setRoundNumber(data.roundNumber);
  }

  if (typeof data.lastPlayerId === 'number') {
    setCurrentTurnPlayerId(data.lastPlayerId);
  }

  // 记录上一次出牌动作（上家出的牌数）
  if (Array.isArray(data.playedCards) && typeof data.lastPlayerId === 'number') {
    setLastPlayedAction({ playerId: data.lastPlayerId, cardsCount: data.playedCards.length });
  }

  // 更新开枪者的牌数为0（或根据需要调整）
  if (typeof data.loserId === 'number') {
    updatePlayerCardCount(data.loserId, 0);

    const alive = !data.loserDead;
    setPlayerAlive(data.loserId, alive);

    const currentBullets = (playersBulletsLeft && typeof playersBulletsLeft[data.loserId] === 'number')
      ? playersBulletsLeft[data.loserId]
      : 6;
    const nextCount = alive ? Math.max(0, currentBullets - 1) : 0;
    setPlayerBullets(data.loserId, nextCount);

    // 如果输家死亡（loserDead），并且是当前玩家，则更新本地 myGamePlayer.alive
    try {
      if (!alive && myGamePlayer && myGamePlayer.playerId === data.loserId) {
        const updated = { ...myGamePlayer, alive: false };
        setMyGamePlayer(updated);
      }
      if (alive && myGamePlayer && myGamePlayer.playerId === data.loserId && myGamePlayer.alive === false) {
        const updated = { ...myGamePlayer, alive: true };
        setMyGamePlayer(updated);
      }
    } catch (e) {
      console.warn('设置 myGamePlayer 状态失败', e);
    }
  }

  setChallengeReveal(data);
}

/**
 * 注册服务器推送的质疑结果处理器 (GAME:CHALLENGE_RESULT)
 * callback 会收到完整的 `ChallengeResultData`，并返回一个注销函数
 */
export function registerChallengeResultHandler(callback: (data: ChallengeResultData) => void) {
  const { registerHandler, unregisterHandler } = useWebSocketStore.getState();

  registerHandler({
    module: MessageModule.GAME,
    cmd: GameCommand.CHALLENGE_RESULT,
    handler: (message) => {
      const data = message.data as ChallengeResultData;
      if (!data || typeof data.gameId !== 'number') {
        console.warn('收到无效的 CHALLENGE_RESULT 数据', message);
        return;
      }

      try {
        // 本地更新游戏状态
        handleChallengeResultLocally(data);

        // 回调业务层
        callback(data);
      } catch (e) {
        console.error('处理 CHALLENGE_RESULT 错误', e);
      }
    },
    description: '处理质疑结果推送'
  });

  return () => unregisterHandler(MessageModule.GAME, GameCommand.CHALLENGE_RESULT);
}

export default {
  challenge,
  registerChallengeResultHandler
};
