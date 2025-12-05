import { API_CONFIG } from '../config';
import { useAuthStore } from '../store/authStore';
import { useRoomStore } from '../store/roomStore';

// 创建房间相关类型定义
export interface CreateRoomParams {
  roomName: string;
  gameMode: 'CLASSIC' | 'QUICK' | 'CUSTOM';
  maxPlayers: number;
}

export interface PlayerVO {
  playerId?: number;
  nickname?: string;
  status?: string;
  avatar?: string;
  isPrepared?: boolean;
  isOwner?: boolean;
}

export interface CreateRoomResponse {
  roomId?: number;
  roomName?: string;
  ownerId?: number;
  roomStatus?: string;
  gameModeName?: string;
  currentPlayerCount?: number;
  maxPlayers?: number;
  availableSlots?: number;
  isPrivate?: boolean;
  description?: string;
  players?: PlayerVO[];
  createdAt?: string;
  backgroundMusic?: string;
  extConfig?: string;
}

// 创建房间函数
export async function createRoom(params: CreateRoomParams): Promise<CreateRoomResponse> {
  // 获取token
  const authToken = useAuthStore.getState().getToken();
  
  if (!authToken) {
    throw new Error('未找到认证token，请先登录');
  }

  try {
    // 构建查询参数
    const queryParams = new URLSearchParams({
      roomName: params.roomName,
      gameMode: params.gameMode,
      maxPlayers: params.maxPlayers.toString(),
    });

    // 发送 GET 请求到创建房间端点
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ROOM_CREATE}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // token过期或无效，清除认证信息
        useAuthStore.getState().clearAuth();
        throw new Error('认证失败，请重新登录');
      }
      throw new Error(`创建房间失败: ${response.status} ${response.statusText}`);
    }

    const data: CreateRoomResponse = await response.json();
    
    // 创建房间成功后，更新房间状态
    useRoomStore.getState().setCurrentRoom(data);
    
    return data;
  } catch (error) {
    console.error('创建房间时发生错误:', error);
    throw error;
  }
}

// 游戏模式常量
export const GameMode = {
  CLASSIC: 'CLASSIC',
  QUICK: 'QUICK',
  CUSTOM: 'CUSTOM',
} as const;

export type GameMode = typeof GameMode[keyof typeof GameMode];

// 房间状态常量
export const RoomStatus = {
  WAITING: '等待中',
  PLAYING: '游戏中',
  FINISHED: '已结束',
} as const;

export type RoomStatus = typeof RoomStatus[keyof typeof RoomStatus];

// 玩家状态常量
export const PlayerStatus = {
  ONLINE: '在线',
  OFFLINE: '离线',
  READY: '准备',
} as const;

export type PlayerStatus = typeof PlayerStatus[keyof typeof PlayerStatus];