import React, { useMemo } from 'react';
import { useGameInfo } from '../../../store/gameStore';
import { useCurrentRoom } from '../../../store/roomStore';
import './GameTable.less';

const GameTable: React.FC = () => {
  const { lastPlayedAction } = useGameInfo();
  const { currentRoom } = useCurrentRoom();

  // 获取出牌玩家的信息
  const playedPlayerInfo = useMemo(() => {
    if (!lastPlayedAction || !currentRoom?.players) return null;
    return currentRoom.players.find(p => p.playerId === lastPlayedAction.playerId);
  }, [lastPlayedAction, currentRoom?.players]);

  return (
    <div className="game-table">
      <div className="table-surface">
        <div className="table-center-logo">
          BAR GAME
        </div>

        {/* 显示上一次出牌信息 */}
        {lastPlayedAction && (
          <div className="played-cards-area">
            <div className="played-cards-info">
              {playedPlayerInfo && (
                <div className="player-name">{playedPlayerInfo.nickname} 出了</div>
              )}
              <div className="cards-count-display">
                <div className="card-back-icon">🂠</div>
                <span className="count">x {lastPlayedAction.cardsCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameTable;
