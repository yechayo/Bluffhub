import { MessageModule, GameCommand, type PlayCardsRequest, type PlayerPlayedData } from '../../types/websocketMessages';
import { useWebSocketStore } from '../../store/websocketStore';
import { useGameStore } from '../../store/gameStore';
import type { Card } from '../../types/websocketMessages';
import { handleMustChallengeResponse } from './playerMustChallenge';

/**
 * 玩家出牌请求
 * @param gameId 游戏ID
 * @param cards 要出的牌列表
 * @returns Promise<void>
 */
export async function playCards(gameId: number, cards: Card[]): Promise<void> {
  const { sendMessage } = useWebSocketStore.getState();

  if (!gameId) {
    throw new Error('游戏ID不能为空');
  }

  if (!cards || cards.length === 0) {
    throw new Error('请选择要出的牌');
  }

  // cards 字段必须是字符串数组
  const cardStrings = cards.map(card => card.type);
  const requestData: PlayCardsRequest = {
    gameId,
    cards: cardStrings
  };

  try {
    const response = await sendMessage(
      {
        module: MessageModule.GAME,
        cmd: GameCommand.PLAY_CARDS,
        code: 200,
        msg: 'success',
        data: requestData
      },
      {
        expectResponse: true,
        timeout: 5000
      }
    );

    // 如果后端返回特定消息，表示对手无手牌，必须质疑而不是出牌
    try {
      handleMustChallengeResponse(response);
    } catch (e) {
      // 将错误抛出以通知调用方取消本次出牌（UI 层会回滚手牌移除）
      console.warn('收到必须质疑的响应，取消出牌', e);
      throw e;
    }

    if (response.code !== 200) {
      throw new Error(response.msg || '出牌失败');
    }

    console.log('出牌成功:', response);

    // 有些后端实现会把下一个出牌玩家放在对 play_cards 请求的响应里
    // 如果存在 nextPlayerId，立刻更新本地状态，避免依赖广播通知
    try {
      const respData = response.data as any;
      if (respData && respData.nextPlayerId != null) {
        const { setCurrentTurnPlayerId } = useGameStore.getState();
        setCurrentTurnPlayerId(Number(respData.nextPlayerId));
      }
    } catch (e) {
      // 忽略解析错误，广播处理器仍可在收到通知时更新状态
      console.warn('解析出牌响应时未能更新 nextPlayerId', e);
    }
  } catch (error) {
    console.error('出牌失败:', error);
    throw error;
  }
}

/**
 * 注册玩家出牌广播处理器 (GAME:PLAYER_PLAYED)
 * 该消息在任意玩家出牌后广播给所有玩家
 * 返回一个用于注销的函数。
 */
export function registerPlayerPlayedHandler(callback: (data: PlayerPlayedData) => void) {
  const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
  
  registerHandler({
    module: MessageModule.GAME,
    cmd: GameCommand.PLAYER_PLAYED,
    handler: (message) => {
      const data = message.data as PlayerPlayedData;
      if (data && data.gameId && data.playerId) {
        console.log('收到玩家出牌广播:', data);
        
        // 更新游戏状态
        const { setCurrentTurnPlayerId, setRoundNumber, setLastPlayedAction, updatePlayerCardCount } = useGameStore.getState();
        
        // 记录上一次出牌动作
        setLastPlayedAction({
          playerId: data.playerId,
          cardsCount: data.cardsCount
        });

        // 更新该玩家的手牌数量
        if (typeof data.remainingCards === 'number') {
          updatePlayerCardCount(data.playerId, data.remainingCards);
        }

        // 更新当前回合玩家为下一个玩家
        if (data.nextPlayerId) {
          setCurrentTurnPlayerId(data.nextPlayerId);
        }
        
        // 更新轮次编号
        if (data.roundNumber) {
          setRoundNumber(data.roundNumber);
        }
        
        // 如果是当前玩家出牌，需要从手牌中移除已出的牌
        const { myGamePlayer } = useGameStore.getState();
        if (myGamePlayer && myGamePlayer.playerId === data.playerId) {
          // 注意：后端会在 GAME_STARTED 或其他消息中更新玩家的手牌
          // 这里我们只更新回合状态，手牌更新交由后端推送
          console.log('当前玩家出牌，剩余手牌数量:', data.remainingCards);
        }
        
        // 调用回调函数，让业务层处理具体的UI更新
        callback(data);
      }
    },
    description: '玩家出牌广播通知'
  });
  
  return () => unregisterHandler(MessageModule.GAME, GameCommand.PLAYER_PLAYED);
}

/**
 * 从手牌中移除指定的卡牌
 * @param cards 要移除的卡牌
 */
export function removeCardsFromHand(cards: Card[]): void {
  const { myHandCards, setMyHandCards } = useGameStore.getState();
  
  // 创建一个副本进行操作
  const remainingCards = [...myHandCards];
  
  // 遍历要移除的牌
  cards.forEach(cardToRemove => {
    // 找到第一张匹配的牌并移除
    const index = remainingCards.findIndex(card => 
      card.type === cardToRemove.type && 
      (!cardToRemove.suit || card.suit === cardToRemove.suit)
    );
    
    if (index !== -1) {
      remainingCards.splice(index, 1);
    }
  });
  
  // 更新手牌
  setMyHandCards(remainingCards);
}

/**
 * 检查是否是当前玩家的回合
 * @returns boolean
 */
export function isMyTurn(): boolean {
  const { currentTurnPlayerId, myGamePlayer } = useGameStore.getState();
  
  if (!currentTurnPlayerId || !myGamePlayer) {
    return false;
  }
  
  return currentTurnPlayerId === myGamePlayer.playerId;
}

/**
 * 检查选中的牌是否在手牌中
 * @param selectedCards 选中的牌
 * @returns boolean
 */
export function validateSelectedCards(selectedCards: Card[]): boolean {
  const { myHandCards } = useGameStore.getState();
  
  if (!selectedCards || selectedCards.length === 0) {
    return false;
  }
  
  // 检查每张选中的牌是否都在手牌中
  const handCardsCopy = [...myHandCards];
  
  for (const selectedCard of selectedCards) {
    const index = handCardsCopy.findIndex(card => 
      card.type === selectedCard.type && 
      (!selectedCard.suit || card.suit === selectedCard.suit)
    );
    
    if (index === -1) {
      return false; // 找不到这张牌
    }
    
    // 移除已匹配的牌，避免重复匹配
    handCardsCopy.splice(index, 1);
  }
  
  return true;
}

export default {
  playCards,
  registerPlayerPlayedHandler,
  removeCardsFromHand,
  isMyTurn,
  validateSelectedCards
};
