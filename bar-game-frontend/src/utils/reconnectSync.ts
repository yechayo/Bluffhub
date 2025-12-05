/**
 * 重连同步协调器
 * 处理 SYSTEM:RECONNECT 消息，统一恢复大厅/房间/游戏状态
 */

import type {
  SystemReconnectPayload,
  Card
} from '../types/websocketMessages';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import type { CreateRoomResponse, PlayerVO } from './createRoom';
import { emitReconnectRouteTarget } from './reconnectSyncRoute';

// 在线用户缓存更新回调（由 useOnlineUsers 注册）
let onlineUsersUpdateCallback: ((data: { onlineCount: number; onlineUsers: any[] }) => void) | null = null;

/**
 * 注册在线用户更新回调
 * @param callback 更新回调函数
 */
export const registerOnlineUsersCallback = (
  callback: (data: { onlineCount: number; onlineUsers: any[] }) => void
): void => {
  onlineUsersUpdateCallback = callback;
};

/**
 * 注销在线用户更新回调
 */
export const unregisterOnlineUsersCallback = (): void => {
  onlineUsersUpdateCallback = null;
};

/**
 * 将重连数据中的手牌转换为 Card 对象数组
 * 支持字符串数组或对象数组两种格式
 */
const convertHandCards = (handCards: any[]): Card[] => {
  if (!handCards || handCards.length === 0) return [];
  
  // 检查是否是对象数组 [{type: "A"}] 还是字符串数组 ["A"]
  if (typeof handCards[0] === 'object' && handCards[0].type) {
    return handCards.map(card => ({ type: card.type }));
  }
  // 字符串数组
  return handCards.map(cardType => ({ type: cardType as string }));
};

/**
 * 将重连房间玩家数据转换为 PlayerVO 格式
 */
const convertToPlayerVO = (players: SystemReconnectPayload['players']): PlayerVO[] => {
  if (!players) return [];
  return players.map(p => ({
    playerId: p.playerId,
    nickname: p.nickname,
    status: p.status,
    avatar: p.avatar || undefined,
    isPrepared: p.isPrepared,
    isOwner: p.isOwner
  }));
};

/**
 * 将重连数据转换为 CreateRoomResponse 格式
 */
const convertToRoomResponse = (data: SystemReconnectPayload): CreateRoomResponse | null => {
  if (data.roomId == null) return null;

  return {
    roomId: data.roomId,
    roomName: data.roomName,
    ownerId: data.ownerId,
    roomStatus: data.roomStatus,
    gameModeName: data.gameModeName,
    currentPlayerCount: data.currentPlayerCount,
    maxPlayers: data.maxPlayers,
    availableSlots: data.availableSlots,
    isPrivate: data.isPrivate,
    description: data.description || undefined,
    players: convertToPlayerVO(data.players)
  };
};

/**
 * 水合房间状态
 */
const hydrateRoomState = (data: SystemReconnectPayload): void => {
  const roomStore = useRoomStore.getState();

  if (data.roomId != null) {
    // 用户在房间中，恢复房间状态
    const roomData = convertToRoomResponse(data);
    if (roomData) {
      roomStore.setCurrentRoom(roomData);
      console.log('[ReconnectSync] 房间状态已恢复:', roomData.roomId);
    }
  } else {
    // 用户不在房间中，清空房间状态
    roomStore.clearRoom();
    console.log('[ReconnectSync] 用户不在房间中，已清空房间状态');
  }
};

/**
 * 水合游戏状态
 * 判断是否在游戏中：直接根据 gameId 是否为 null 判断
 * 注意：roomStatus 不会变为 "PLAYING"，游戏和房间是独立逻辑
 */
const hydrateGameState = (data: SystemReconnectPayload, myPlayerId: number): void => {
  const gameStore = useGameStore.getState();

  // 直接根据 gameId 判断是否在游戏中
  if (data.gameId != null) {
    // 用户在游戏中，恢复游戏状态
    console.log('[ReconnectSync] 检测到 gameId，用户在游戏中:', data.gameId);
    
    gameStore.setGameId(data.gameId);
    gameStore.setGameStarted(true);

    // 恢复座位顺序
    if (data.playerIds && data.playerIds.length > 0) {
      gameStore.setPlayerSeats(data.playerIds);
      gameStore.getMySeatIndex(myPlayerId);

      // 初始化玩家存活状态（默认全部存活，后续由具体状态更新）
      gameStore.initializePlayersAlive(data.playerIds);
    }

    // 恢复当前轮次信息
    if (data.roundNumber != null) {
      gameStore.setRoundNumber(data.roundNumber);
    }

    if (data.targetCardType) {
      gameStore.setTargetCardType(data.targetCardType);
    }

    if (data.firstPlayerId != null) {
      gameStore.setCurrentTurnPlayerId(data.firstPlayerId);
    }

    // 恢复当前玩家的游戏信息（包含手牌）
    if (data.gamePlayers) {
      const myGamePlayer = data.gamePlayers;
      // 注意：后端返回的字段是 bulletCount，需要兼容处理
      const bullets = (myGamePlayer as any).bulletCount ?? myGamePlayer.bullets ?? 6;
      
      gameStore.setMyGamePlayer({
        playerId: myGamePlayer.playerId,
        userId: myGamePlayer.userId,
        nickname: myGamePlayer.nickname,
        handCards: convertHandCards(myGamePlayer.handCards as any),
        alive: myGamePlayer.alive,
        bullets: bullets,
        bulletsUsed: myGamePlayer.bulletsUsed ?? false
      });

      // 更新当前玩家的存活状态
      gameStore.setPlayerAlive(myGamePlayer.playerId, myGamePlayer.alive);
      // 更新当前玩家的子弹数
      gameStore.setPlayerBullets(myGamePlayer.playerId, bullets);
    }

    // 恢复其他玩家的公开信息（手牌数量和子弹数量）
    if (data.playerIds && data.handCards && data.bulletCounts) {
      // 初始化手牌数量映射
      const cardCounts: Record<number, number> = {};
      const bulletCounts: Record<number, number> = {};

      data.playerIds.forEach((playerId, index) => {
        cardCounts[playerId] = data.handCards![index] ?? 0;
        bulletCounts[playerId] = data.bulletCounts![index] ?? 6;
      });

      // 批量更新手牌数量
      data.playerIds.forEach(playerId => {
        gameStore.updatePlayerCardCount(playerId, cardCounts[playerId]);
        gameStore.setPlayerBullets(playerId, bulletCounts[playerId]);
      });
    }

    console.log('[ReconnectSync] 游戏状态已恢复:', {
      gameId: data.gameId,
      roundNumber: data.roundNumber,
      targetCardType: data.targetCardType,
      playerCount: data.playerIds?.length,
      myHandCards: data.gamePlayers?.handCards
    });
  } else {
    // gameId 为 null，用户不在游戏中，清空游戏状态
    gameStore.clearGame();
    console.log('[ReconnectSync] gameId 为空，用户不在游戏中，已清空游戏状态');
  }
};

/**
 * 水合在线用户列表
 */
const hydrateOnlineUsers = (data: SystemReconnectPayload): void => {
  if (data.onlineListResponse && onlineUsersUpdateCallback) {
    onlineUsersUpdateCallback({
      onlineCount: data.onlineListResponse.onlineCount,
      onlineUsers: data.onlineListResponse.onlineUsers
    });
    console.log('[ReconnectSync] 在线用户列表已更新:', data.onlineListResponse.onlineCount);
  }
};

/**
 * 主同步函数 - 处理重连消息并恢复所有状态
 * @param payload 重连消息数据
 * @param myPlayerId 当前用户的玩家ID
 */
export const handleReconnectSync = (payload: SystemReconnectPayload, myPlayerId: number): void => {
  console.log('[ReconnectSync] 开始处理重连同步数据...');

  try {
    // 1. 更新在线用户列表
    hydrateOnlineUsers(payload);

    // 2. 恢复房间状态
    hydrateRoomState(payload);

    // 3. 恢复游戏状态（依赖房间状态）
    hydrateGameState(payload, myPlayerId);

    // 4. 计算并发出路由目标（全局路由守卫根据该结果跳转）
    emitReconnectRouteTarget(payload);

    console.log('[ReconnectSync] 重连同步完成');
  } catch (error) {
    console.error('[ReconnectSync] 重连同步失败:', error);
    throw error;
  }
};

export default handleReconnectSync;
