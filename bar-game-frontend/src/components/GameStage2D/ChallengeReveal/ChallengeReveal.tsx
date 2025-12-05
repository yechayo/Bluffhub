import React, { useEffect, useState } from 'react';
import { useGameInfo, useGameActions } from '../../../store/gameStore';
import { useCurrentRoom } from '../../../store/roomStore';
import { registerChallengeResultHandler } from '../../../utils/GameLogic/playerLiar';
import type { ChallengeResultData } from '../../../types/websocketMessages';
import './ChallengeReveal.less';

const PHASE_DURATION = {
  bullet: 1200,
  result: 2500,
  finish: 4200
};

const ChallengeReveal: React.FC = () => {
  const { challengeReveal } = useGameInfo();
  const { clearChallengeReveal, setChallengeAnimationPhase } = useGameActions();
  const { currentRoom } = useCurrentRoom();

  const [visible, setVisible] = useState(false);
  const [dataSnapshot, setDataSnapshot] = useState<ChallengeResultData | null>(null);

  // 保持 WebSocket 质疑结果的订阅
  useEffect(() => {
    const unregister = registerChallengeResultHandler(() => {
      // 本地处理在 playerLiar 中完成，这里仅确保注册生效
    });
    return unregister;
  }, []);

  // 当 store 中有新的质疑结果时开始动画
  useEffect(() => {
    if (!challengeReveal) {
      return;
    }

    setDataSnapshot(challengeReveal);
    setVisible(true);
    setChallengeAnimationPhase('flip');

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setChallengeAnimationPhase('bullet'), PHASE_DURATION.bullet));
    timers.push(setTimeout(() => setChallengeAnimationPhase('result'), PHASE_DURATION.result));
    timers.push(setTimeout(() => {
      setChallengeAnimationPhase('idle');
      setVisible(false);
      clearChallengeReveal();
    }, PHASE_DURATION.finish));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [challengeReveal, clearChallengeReveal, setChallengeAnimationPhase]);

  if (!visible || !dataSnapshot) {
    return null;
  }

  const { playedCards = [], lastPlayerId } = dataSnapshot;
  const shooter = currentRoom?.players?.find(p => p.playerId === lastPlayerId);

  const getCardInfo = (card: any) => {
    const suitMap: Record<string, { symbol: string; color: 'red' | 'black' }> = {
      HEARTS: { symbol: '♥', color: 'red' },
      DIAMONDS: { symbol: '♦', color: 'red' },
      SPADES: { symbol: '♠', color: 'black' },
      CLUBS: { symbol: '♣', color: 'black' }
    };
    const typeColorMap: Record<string, 'red' | 'black'> = {
      Q: 'black',
      K: 'red',
      A: 'black',
      JOKER: 'red'
    };

    if (card == null) {
      return { rank: '', suit: '', color: 'black' as const };
    }

    if (typeof card === 'string' || typeof card === 'number') {
      const rank = String(card);
      return { rank, suit: '', color: typeColorMap[rank] || 'black' };
    }

    if (typeof card === 'object') {
      const rank = 'type' in card ? String(card.type) : ('rank' in card ? String(card.rank) : '');
      const suit = 'suit' in card ? String(card.suit) : '';
      const suitInfo = suitMap[suit];
      return {
        rank,
        suit: suitInfo?.symbol || '',
        color: suitInfo?.color || typeColorMap[rank] || 'black'
      };
    }

    const rank = String(card);
    return { rank, suit: '', color: typeColorMap[rank] || 'black' };
  };

  return (
    <div className="challenge-reveal-overlay">
      <div className="reveal-panel">
        <div className="reveal-header">
          <span>{shooter?.nickname || `玩家 ${lastPlayerId}`} 的真实出牌</span>
        </div>
        <div className="card-reveal">
          {playedCards.map((card, idx) => {
            const info = getCardInfo(card);
            return (
              <div key={idx} className={`reveal-card ${info.color} flip`}>
                <span className="rank">{info.rank}</span>
                {info.suit && <span className="suit">{info.suit}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChallengeReveal;
