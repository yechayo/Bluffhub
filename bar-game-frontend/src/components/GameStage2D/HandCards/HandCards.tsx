import React, { useMemo, useState, useEffect } from 'react';
import Card from '../Card/Card';
import { useGameInfo } from '../../../store/gameStore';
import { playCards, registerPlayerPlayedHandler, isMyTurn, validateSelectedCards, removeCardsFromHand } from '../../../utils/GameLogic/playerHandle';
import { challenge } from '../../../utils/GameLogic/playerLiar';
import message from '../../common/Message';
import DebouncedButton from '../../common/DebouncedButton';
import type { Card as CardType } from '../../../types/websocketMessages';
import './HandCards.less';

// 花色映射：后端的花色名称映射到显示符号（如果有花色）
const suitMap: Record<string, { symbol: string; color: 'red' | 'black' }> = {
  HEARTS: { symbol: '♥', color: 'red' },
  DIAMONDS: { symbol: '♦', color: 'red' },
  SPADES: { symbol: '♠', color: 'black' },
  CLUBS: { symbol: '♣', color: 'black' }
};

// 牌型颜色映射：根据牌型决定颜色
const cardTypeColorMap: Record<string, 'red' | 'black'> = {
  'Q': 'black',
  'K': 'red',
  'A': 'black',
  'JOKER': 'red'
};

const HandCards: React.FC = () => {
  const { myHandCards, gameId, currentTurnPlayerId, myGamePlayer, lastPlayedAction, playersCardCounts, playerSeats, roundNumber } = useGameInfo();
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);

  // 注册玩家出牌广播处理器
  useEffect(() => {
    const unregister = registerPlayerPlayedHandler((data) => {
      console.log('玩家出牌广播:', data);
      // 清空选中状态
      setSelectedIndices([]);
    });
    
    return unregister;
  }, []);

  // 检查是否是当前玩家的回合
  const myTurn = useMemo(() => {
    return isMyTurn();
  }, [currentTurnPlayerId, myGamePlayer]);

  // 检查是否只能质疑（其他玩家手牌都为空）
  const onlyChallengeAvailable = useMemo(() => {
    if (!myGamePlayer || !playerSeats.length) return false;
    
    // 检查是否还有其他玩家有手牌
    const otherPlayersHaveCards = playerSeats.some(playerId => 
      playerId !== myGamePlayer.playerId && (playersCardCounts[playerId] || 0) > 0
    );
    
    return !otherPlayersHaveCards;
  }, [playerSeats, playersCardCounts, myGamePlayer]);

  // 将后端的卡牌数据转换为组件所需格式
  const cards = useMemo(() => {
    return myHandCards.map(card => {
      // 如果有花色，使用花色符号；否则不显示花色
      let suit = '';
      let color: 'red' | 'black' = 'black';
      
      if (card.suit) {
        const suitInfo = suitMap[card.suit];
        if (suitInfo) {
          suit = suitInfo.symbol;
          color = suitInfo.color;
        }
      } else {
        // 没有花色时，根据牌型决定颜色
        color = cardTypeColorMap[card.type] || 'black';
      }
      
      return {
        suit,
        rank: card.type,
        color
      };
    });
  }, [myHandCards]);

  // 处理卡牌选择
  const handleCardClick = (index: number) => {
    if (!myTurn) {
      // 使用统一的消息提示替代 console.log/alert
      message.info('还没轮到你出牌');
      return;
    }

    if (onlyChallengeAvailable) {
      message.info('其他玩家已无手牌，只能质疑');
      return;
    }

    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        // 如果已经选中，取消选中
        return prev.filter(i => i !== index);
      } else {
        // 如果未选中，检查是否已达到最大选择数量（3张）
        if (prev.length >= 3) {
          message.warning('每次最多只能选择3张牌');
          return prev;
        }
        // 添加到选中列表
        return [...prev, index];
      }
    });
  };

  // 处理出牌
  const handlePlayCards = async () => {
    if (!myTurn) {
      message.info('还没轮到你出牌');
      return;
    }

    if (selectedIndices.length === 0) {
      message.warning('请选择要出的牌');
      return;
    }

    // 限制出牌数量为1-3张
    if (selectedIndices.length < 1 || selectedIndices.length > 3) {
      message.warning('每次只能出1-3张牌');
      return;
    }

    // 获取选中的卡牌
    const selectedCards: CardType[] = selectedIndices.map(index => myHandCards[index]);

    // 验证选中的牌
    if (!validateSelectedCards(selectedCards)) {
      message.warning('选中的牌不在手牌中');
      return;
    }

    setIsPlaying(true);
    try {
      await playCards(gameId!, selectedCards);
      console.log('出牌成功');
      
      // 从手牌中移除已出的牌
      removeCardsFromHand(selectedCards);
      
      // 清空选中状态会在广播处理器中完成，但为了即时反馈也可以在这里清空
      setSelectedIndices([]);
    } catch (error: any) {
      console.error('出牌失败:', error);
      message.error(error?.message || '出牌失败，请重试');
    } finally {
      setIsPlaying(false);
    }
  };

  // 处理质疑
  const handleChallenge = async () => {
    if (!myGamePlayer) {
      message.warning('未获取到玩家信息');
      return;
    }

    if (!gameId) {
      message.warning('gameId 未知');
      return;
    }

    // 不能质疑自己出的牌（如果有上次出牌记录）
    if (lastPlayedAction && lastPlayedAction.playerId === myGamePlayer.playerId) {
      message.info('不能质疑自己出的牌');
      return;
    }

    setIsChallenging(true);
    try {
      await challenge(gameId);
      message.success('已发送质疑请求');
    } catch (error: any) {
      console.error('质疑请求失败', error);
      message.error(error?.message || '质疑请求失败');
    } finally {
      setIsChallenging(false);
    }
  };

  // 判断是否可以质疑：
  // 1. 轮到自己
  // 2. 不是第一轮的第一个出牌（roundNumber > 1 或者有出牌记录）
  // 3. 上次出牌不是自己出的（如果有记录的话）
  const canChallenge = useMemo(() => {
    if (!myTurn || !myGamePlayer) return false;
    
    // 如果有出牌记录，检查不是自己出的
    if (lastPlayedAction) {
      return lastPlayedAction.playerId !== myGamePlayer.playerId;
    }
    
    // 没有出牌记录时（可能是刷新后）：
    // 如果是第1轮，只有第一个出牌的人不能质疑（因为还没人出过牌）
    // 如果是第2轮及以后，所有人都可以质疑（因为上一轮一定有人出过牌）
    if (roundNumber > 1) {
      return true; // 第2轮及以后，任何时候都可以质疑
    }
    
    // 第1轮：无法判断是否有人出过牌，保守起见允许质疑（后端会校验）
    return true;
  }, [myTurn, myGamePlayer, lastPlayedAction, roundNumber]);

  // 如果没有手牌，显示等待提示
  if (cards.length === 0) {
    return (
      <div className="hand-cards-container">
        <div className="waiting-cards">等待游戏开始...</div>
      </div>
    );
  }

  return (
    <div className="hand-cards-container">
      <div className="hand-cards-area">
        {cards.map((card, index) => (
          <div 
            key={index} 
            className={`hand-card-wrapper ${
              selectedIndices.includes(index) ? 'selected' : ''
            } ${
              !myTurn || (selectedIndices.length >= 3 && !selectedIndices.includes(index)) ? 'disabled' : ''
            }`}
            onClick={() => handleCardClick(index)}
          >
            <Card suit={card.suit} rank={card.rank} color={card.color} />
          </div>
        ))}
      </div>
      
      {/* 出牌与质疑按钮 */}
      {myTurn && (
        <div className="play-button-container">
          {onlyChallengeAvailable && (
             <span style={{ marginRight: 8, color: '#fff', fontSize: '14px', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
               其他玩家已无手牌，只能质疑
             </span>
          )}
          {!onlyChallengeAvailable && selectedIndices.length > 0 && (
            <DebouncedButton 
              className="play-button"
              onClick={handlePlayCards}
              disabled={isPlaying}
              debounceDelay={800}
            >
              {isPlaying ? '出牌中...' : `出牌 (${selectedIndices.length})`}
            </DebouncedButton>
          )}
          {/* 质疑按钮常驻显示，只要可以质疑就显示 */}
          {canChallenge && (
            <DebouncedButton 
              className="challenge-button" 
              onClick={handleChallenge} 
              disabled={isChallenging}
              debounceDelay={1000}
              style={{ marginLeft: 8 }}
            >
              {isChallenging ? '质疑中...' : '质疑'}
            </DebouncedButton>
          )}
        </div>
      )}
      
      {/* 回合提示 */}
      {!myTurn && cards.length > 0 && (
        <div className="turn-hint">
          等待其他玩家出牌...
        </div>
      )}
    </div>
  );
};

export default HandCards;
