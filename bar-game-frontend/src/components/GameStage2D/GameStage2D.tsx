import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Modal, Button, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import GameTable from './GameTable/GameTable';
import PlayerArea from './PlayerArea/PlayerArea';
import HandCards from './HandCards/HandCards';
import ChallengeReveal from './ChallengeReveal/ChallengeReveal';
import YourTurnIndicator from './YourTurnIndicator/YourTurnIndicator';
import { useGameInfo, useGameActions } from '../../store/gameStore';
import { useCurrentRoom } from '../../store/roomStore';
import { leaveGame } from '../../utils/GameLogic/leaveGame';
import './GameStage2D.less';

// 飞入动画组件
const FlyingTargetCard: React.FC<{ targetCardType: string | null }> = ({ targetCardType }) => {
  const [animate, setAnimate] = useState(false);
  const [displayCard, setDisplayCard] = useState<string | null>(null);
  const prevCardRef = useRef<string | null>(null);

  useEffect(() => {
    // 只有当 targetCardType 变化且不为空时触发
    if (targetCardType && targetCardType !== prevCardRef.current) {
      // 延迟启动动画，给上一轮结算留出时间
      const startTimer = setTimeout(() => {
        setDisplayCard(targetCardType);
        setAnimate(true);
        
        setTimeout(() => {
          setAnimate(false);
        }, 2500); // 动画总时长
      }, 4500); // 延迟4秒
      
      prevCardRef.current = targetCardType;
      return () => clearTimeout(startTimer);
    }
    // 如果 targetCardType 变为空（例如重置），也更新 ref
    if (!targetCardType) {
        prevCardRef.current = null;
    }
  }, [targetCardType]);

  if (!animate || !displayCard) return null;

  return (
    <div className={`flying-target-card card-${displayCard}`}>
      {displayCard}
    </div>
  );
};

const GameStage2D: React.FC = () => {
  const { gameId, playerSeats, mySeatIndex, currentTurnPlayerId, targetCardType, roundNumber, playersCardCounts, myGamePlayer, playersAlive, playersBulletsLeft, challengeReveal, challengeAnimationPhase } = useGameInfo();
  const { setGameStarted, clearGame } = useGameActions();
  const { currentRoom } = useCurrentRoom();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();

  const handleLeaveGame = () => {
    Modal.confirm({
      title: '确认离开游戏？',
      content: '离开后将被视为死亡，且无法重新加入本局游戏。',
      okText: '确认离开',
      cancelText: '取消',
      onOk: async () => {
        if (gameId) {
          try {
            await leaveGame(gameId);
            message.success('已离开游戏');
            // 主动退出逻辑，防止未收到广播导致卡在游戏界面
            setGameStarted(false);
            clearGame();
            if (roomId) {
                navigate(`/room/${roomId}`);
            }
          } catch (error) {
            console.error('离开游戏失败:', error);
            message.error('离开游戏失败，请重试');
          }
        }
      }
    });
  };

  // 判断是否是我的回合
  const isMyTurn = useMemo(() => {
    return currentTurnPlayerId !== null && myGamePlayer?.playerId === currentTurnPlayerId;
  }, [currentTurnPlayerId, myGamePlayer]);

  // 获取当前回合玩家信息
  const currentTurnPlayer = useMemo(() => {
    if (!currentTurnPlayerId || !currentRoom?.players) return null;
    return currentRoom.players.find(p => p.playerId === currentTurnPlayerId);
  }, [currentTurnPlayerId, currentRoom?.players]);

  // 根据座位顺序和房间玩家信息构建显示数据
  const playersToDisplay = useMemo(() => {
    if (!playerSeats.length || !currentRoom?.players || mySeatIndex === null) return [];

    // 位置映射：相对于当前玩家的位置（当前玩家始终在底部）
    // 0=底部(自己), 1=右侧, 2=对面(顶部), 3=左侧
    const positionMap: Array<'bottom' | 'right' | 'top' | 'left'> = ['bottom', 'right', 'top', 'left'];

    return playerSeats.map((playerId, seatIndex) => {
      const player = currentRoom.players?.find(p => p.playerId === playerId);
      const isSelf = mySeatIndex === seatIndex;
      
      // 计算相对位置：以当前玩家为基准(底部)，其他玩家按相对座位排列
      const relativePosition = (seatIndex - mySeatIndex + 4) % 4;
      const position = positionMap[relativePosition];

      return {
        seatIndex,
        playerId,
        position,
        name: player?.nickname || `玩家 ${playerId}`,
        avatar: player?.avatar,
        isSelf,
        cardCount: playersCardCounts[playerId] || 0,
        bulletsLeft: playersBulletsLeft[playerId] ?? 6,
        isShootingTarget: challengeReveal?.loserId === playerId && challengeAnimationPhase === 'bullet',
        dead: (() => {
          const aliveFromStore = playersAlive[playerId];
          if (typeof aliveFromStore === 'boolean') return !aliveFromStore;
          const aliveFromPlayer = (player as any)?.alive;
          if (typeof aliveFromPlayer === 'boolean') return !aliveFromPlayer;
          if (myGamePlayer && myGamePlayer.playerId === playerId) return myGamePlayer.alive === false;
          return false;
        })()
      };
    });
  }, [playerSeats, currentRoom?.players, mySeatIndex, playersCardCounts, playersAlive, playersBulletsLeft, challengeReveal, challengeAnimationPhase]);

  return (
    <div className="game-stage-2d">
      {/* 当前回合信息显示区域 */}
      <div className="game-info-header">
        {/* 离开游戏按钮 */}
        <div style={{ position: 'absolute', top: '20px', left: '20px', pointerEvents: 'auto' }}>
            <Button 
                type="primary" 
                danger 
                onClick={handleLeaveGame}
            >
                离开游戏
            </Button>
        </div>

        <div className="game-round-info">
          <span className="round-number">第 {roundNumber} 轮</span>
          {targetCardType && (
            <div className="target-card-display">
              <span className="label">目标</span>
              <div className={`target-card-visual card-${targetCardType}`}>
                {targetCardType}
              </div>
            </div>
          )}
        </div>
        <div className="current-turn-info">
          {/* <span className="turn-label">当前出牌:</span> */}
          <div className="current-player">
            {currentTurnPlayer ? (
              <>
                <img 
                  src={currentTurnPlayer.avatar || 'https://picsum.photos/32/32'} 
                  alt="玩家头像" 
                  className="player-avatar-small"
                />
                <span className="player-name">{currentTurnPlayer.nickname}</span>
                {isMyTurn && (
                  <span className="your-turn-badge">你的回合</span>
                )}
              </>
            ) : (
              <span className="waiting-player">等待中...</span>
            )}
          </div>
        </div>
      </div>

      <div className="table-area">
        <GameTable />
      </div>
      
      {/* Players positioned around the table */}
      <div className="players-layer">
        {playersToDisplay.map((player) => (
          <PlayerArea
            key={player.playerId}
            position={player.position}
            name={player.name}
            avatar={player.avatar}
            seatIndex={player.seatIndex}
            isSelf={player.isSelf}
            cardCount={player.cardCount}
            dead={player.dead}
            bulletsLeft={player.bulletsLeft}
            isShootingTarget={player.isShootingTarget}
          />
        ))}
      </div>

      {/* Hand Cards for Self */}
      <div className="hand-cards-layer">
        <HandCards />
      </div>

      <ChallengeReveal />
      
      <FlyingTargetCard targetCardType={targetCardType} />
      <YourTurnIndicator isMyTurn={isMyTurn} />
    </div>
  );
};

export default GameStage2D;
