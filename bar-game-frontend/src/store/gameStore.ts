import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Card, GamePlayer, ChallengeResultData } from '../types/websocketMessages';

// 游戏状态接口
interface GameState {
  // 当前游戏ID
  gameId: number | null;
  
  // 玩家座位顺序（索引即座位号）
  playerSeats: number[];
  
  // 游戏是否已开始
  isGameStarted: boolean;
  
  // 当前玩家的座位号
  mySeatIndex: number | null;
  
  // 当前玩家的手牌
  myHandCards: Card[];
  
  // 当前玩家的游戏信息
  myGamePlayer: GamePlayer | null;
  
  // 当前回合的玩家ID
  currentTurnPlayerId: number | null;
  
  // 本轮目标牌类型
  targetCardType: string | null;
  
  // 当前轮次编号
  roundNumber: number;

  // 上一次出牌动作信息
  lastPlayedAction: {
    playerId: number;
    cardsCount: number;
  } | null;

  // 所有玩家的手牌数量映射 (playerId -> count)
  playersCardCounts: Record<number, number>;

  // 所有玩家的存活状态映射 (playerId -> alive)
  playersAlive: Record<number, boolean>;

  // 左轮剩余子弹数 (playerId -> bullets)
  playersBulletsLeft: Record<number, number>;

  // 最近一次质疑结果，用于触发展示
  challengeReveal: ChallengeResultData | null;

  // 质疑动画阶段
  challengeAnimationPhase: 'idle' | 'flip' | 'bullet' | 'result';
}

// 游戏操作接口
interface GameActions {
  // 设置游戏ID
  setGameId: (gameId: number) => void;
  
  // 设置玩家座位布局
  setPlayerSeats: (playerIds: number[]) => void;
  
  // 设置游戏开始状态
  setGameStarted: (isStarted: boolean) => void;
  
  // 获取当前玩家的座位号
  getMySeatIndex: (myPlayerId: number) => number | null;
  
  // 设置当前玩家的手牌
  setMyHandCards: (cards: Card[]) => void;
  
  // 设置当前玩家的游戏信息
  setMyGamePlayer: (player: GamePlayer) => void;
  
  // 设置当前回合玩家
  setCurrentTurnPlayerId: (playerId: number) => void;
  
  // 设置目标牌类型
  setTargetCardType: (cardType: string) => void;
  
  // 设置轮次编号
  setRoundNumber: (round: number) => void;

  // 设置上一次出牌动作
  setLastPlayedAction: (action: { playerId: number; cardsCount: number } | null) => void;

  // 初始化所有玩家手牌数量
  initializePlayersCardCounts: (playerIds: number[], initialCount: number) => void;

  // 更新指定玩家的手牌数量
  updatePlayerCardCount: (playerId: number, count: number) => void;

  // 初始化所有玩家的存活状态
  initializePlayersAlive: (playerIds: number[]) => void;

  // 更新单个玩家的存活状态
  setPlayerAlive: (playerId: number, alive: boolean) => void;

  // 初始化玩家子弹数
  initializePlayersBullets: (playerIds: number[], initial?: number) => void;

  // 设置玩家剩余子弹
  setPlayerBullets: (playerId: number, bullets: number) => void;

  // 设置/清除最新质疑结果
  setChallengeReveal: (data: ChallengeResultData) => void;
  clearChallengeReveal: () => void;
  
  // 设置质疑动画阶段
  setChallengeAnimationPhase: (phase: 'idle' | 'flip' | 'bullet' | 'result') => void;

  // 清空游戏信息
  clearGame: () => void;
}

// 初始状态
const initialState: GameState = {
  gameId: null,
  playerSeats: [],
  isGameStarted: false,
  mySeatIndex: null,
  myHandCards: [],
  myGamePlayer: null,
  currentTurnPlayerId: null,
  targetCardType: null,
  roundNumber: 0,
  lastPlayedAction: null,
  playersCardCounts: {},
  playersAlive: {},
  playersBulletsLeft: {},
  challengeReveal: null,
  challengeAnimationPhase: 'idle'
};

// 创建游戏状态管理
export const useGameStore = create<GameState & GameActions>()(
  devtools(
    (set, get) => ({
      // 初始状态
      ...initialState,

      // 设置游戏ID
      setGameId: (gameId: number) => {
        set({ gameId });
      },

      // 设置玩家座位布局
      setPlayerSeats: (playerIds: number[]) => {
        set({ playerSeats: playerIds });
      },

      // 设置游戏开始状态
      setGameStarted: (isStarted: boolean) => {
        set({ isGameStarted: isStarted });
      },

      // 获取当前玩家的座位号
      getMySeatIndex: (myPlayerId: number) => {
        const { playerSeats } = get();
        const seatIndex = playerSeats.indexOf(myPlayerId);
        const result = seatIndex >= 0 ? seatIndex : null;
        set({ mySeatIndex: result });
        return result;
      },

      // 设置当前玩家的手牌
      setMyHandCards: (cards: Card[]) => {
        set({ myHandCards: cards });
      },

      // 设置当前玩家的游戏信息
      setMyGamePlayer: (player: GamePlayer) => {
        set({ 
          myGamePlayer: player,
          myHandCards: player.handCards || []
        });
      },

      // 设置当前回合玩家
      setCurrentTurnPlayerId: (playerId: number) => {
        set({ currentTurnPlayerId: playerId });
      },

      // 设置目标牌类型
      setTargetCardType: (cardType: string) => {
        set({ targetCardType: cardType });
      },

      // 设置轮次编号
      setRoundNumber: (round: number) => {
        set({ roundNumber: round });
      },

      // 设置上一次出牌动作
      setLastPlayedAction: (action) => {
        set({ lastPlayedAction: action });
      },

      // 初始化所有玩家手牌数量
      initializePlayersCardCounts: (playerIds: number[], initialCount: number) => {
        const counts: Record<number, number> = {};
        playerIds.forEach(id => {
          counts[id] = initialCount;
        });
        set({ playersCardCounts: counts });
      },

      // 更新指定玩家的手牌数量
      updatePlayerCardCount: (playerId: number, count: number) => {
        set(state => ({
          playersCardCounts: {
            ...state.playersCardCounts,
            [playerId]: count
          }
        }));
      },

      // 初始化玩家存活状态（默认全部存活）
      initializePlayersAlive: (playerIds: number[]) => {
        const aliveMap: Record<number, boolean> = {};
        playerIds.forEach(id => {
          aliveMap[id] = true;
        });
        set({ playersAlive: aliveMap });
      },

      // 更新单个玩家存活状态
      setPlayerAlive: (playerId: number, alive: boolean) => {
        set(state => ({
          playersAlive: {
            ...state.playersAlive,
            [playerId]: alive
          }
        }));
      },

      // 初始化玩家子弹数量（默认6发）
      initializePlayersBullets: (playerIds: number[], initial = 6) => {
        const bullets: Record<number, number> = {};
        playerIds.forEach(id => {
          bullets[id] = initial;
        });
        set({ playersBulletsLeft: bullets });
      },

      // 设置指定玩家的剩余子弹
      setPlayerBullets: (playerId: number, bullets: number) => {
        set(state => ({
          playersBulletsLeft: {
            ...state.playersBulletsLeft,
            [playerId]: Math.max(0, bullets)
          }
        }));
      },

      setChallengeReveal: (data: ChallengeResultData) => {
        set({ challengeReveal: data });
      },

      clearChallengeReveal: () => {
        set({ challengeReveal: null, challengeAnimationPhase: 'idle' });
      },

      setChallengeAnimationPhase: (phase) => {
        set({ challengeAnimationPhase: phase });
      },

      // 清空游戏信息
      clearGame: () => {
        set(initialState);
      }
    }),
    { name: 'GameStore' }
  )
);

// 导出便捷hooks
export const useGameInfo = () => {
  const gameId = useGameStore(state => state.gameId);
  const playerSeats = useGameStore(state => state.playerSeats);
  const isGameStarted = useGameStore(state => state.isGameStarted);
  const mySeatIndex = useGameStore(state => state.mySeatIndex);
  const myHandCards = useGameStore(state => state.myHandCards);
  const myGamePlayer = useGameStore(state => state.myGamePlayer);
  const currentTurnPlayerId = useGameStore(state => state.currentTurnPlayerId);
  const targetCardType = useGameStore(state => state.targetCardType);
  const roundNumber = useGameStore(state => state.roundNumber);
  const lastPlayedAction = useGameStore(state => state.lastPlayedAction);
  const playersCardCounts = useGameStore(state => state.playersCardCounts);
  const playersAlive = useGameStore(state => state.playersAlive);
  const playersBulletsLeft = useGameStore(state => state.playersBulletsLeft);
  const challengeReveal = useGameStore(state => state.challengeReveal);
  const challengeAnimationPhase = useGameStore(state => state.challengeAnimationPhase);

  return {
    gameId,
    playerSeats,
    isGameStarted,
    mySeatIndex,
    myHandCards,
    myGamePlayer,
    currentTurnPlayerId,
    targetCardType,
    roundNumber,
    lastPlayedAction,
    playersCardCounts,
    playersAlive,
    playersBulletsLeft,
    challengeReveal,
    challengeAnimationPhase
  };
};

export const useGameActions = () => {
  const setGameId = useGameStore(state => state.setGameId);
  const setPlayerSeats = useGameStore(state => state.setPlayerSeats);
  const setGameStarted = useGameStore(state => state.setGameStarted);
  const getMySeatIndex = useGameStore(state => state.getMySeatIndex);
  const setMyHandCards = useGameStore(state => state.setMyHandCards);
  const setMyGamePlayer = useGameStore(state => state.setMyGamePlayer);
  const setCurrentTurnPlayerId = useGameStore(state => state.setCurrentTurnPlayerId);
  const setTargetCardType = useGameStore(state => state.setTargetCardType);
  const setRoundNumber = useGameStore(state => state.setRoundNumber);
  const setLastPlayedAction = useGameStore(state => state.setLastPlayedAction);
  const initializePlayersCardCounts = useGameStore(state => state.initializePlayersCardCounts);
  const updatePlayerCardCount = useGameStore(state => state.updatePlayerCardCount);
  const initializePlayersAlive = useGameStore(state => state.initializePlayersAlive);
  const setPlayerAlive = useGameStore(state => state.setPlayerAlive);
  const initializePlayersBullets = useGameStore(state => state.initializePlayersBullets);
  const setPlayerBullets = useGameStore(state => state.setPlayerBullets);
  const setChallengeReveal = useGameStore(state => state.setChallengeReveal);
  const clearChallengeReveal = useGameStore(state => state.clearChallengeReveal);
  const setChallengeAnimationPhase = useGameStore(state => state.setChallengeAnimationPhase);
  const clearGame = useGameStore(state => state.clearGame);

  return {
    setGameId,
    setPlayerSeats,
    setGameStarted,
    getMySeatIndex,
    setMyHandCards,
    setMyGamePlayer,
    setCurrentTurnPlayerId,
    setTargetCardType,
    setRoundNumber,
    setLastPlayedAction,
    initializePlayersCardCounts,
    updatePlayerCardCount,
    initializePlayersAlive,
    setPlayerAlive,
    initializePlayersBullets,
    setPlayerBullets,
    setChallengeReveal,
    clearChallengeReveal,
    setChallengeAnimationPhase,
    clearGame
  };
};

export default useGameStore;
