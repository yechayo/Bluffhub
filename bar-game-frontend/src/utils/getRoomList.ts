import { API_CONFIG } from '../config';
import { useAuthStore } from '../store/authStore';

// 玩家信息接口
export interface PlayerVO {
  playerId: number;
  nickname: string;
  status: string;
  avatar: string;
  isPrepared: boolean;
  isOwner: boolean;
}

// 房间信息接口
export interface RoomVO {
  roomId: number;
  roomName: string;
  ownerId: number;
  roomStatus: string;
  gameModeName: string;
  currentPlayerCount: number;
  maxPlayers: number;
  availableSlots: number;
  isPrivate: boolean;
  description: string;
  players: PlayerVO[];
  createdAt: string;
  backgroundMusic: string;
  extConfig: string;
}

// 房间列表响应接口
export interface RoomListResponse {
  rooms: RoomVO[];
  size: number;
  current: number;
  total: number;
}

// 获取房间列表参数接口
export interface GetRoomListParams {
  current: number; // 当前页码，从1开始
  size: number; // 每页大小，默认10
}

/**
 * 获取房间列表
 * @param params 获取房间列表的参数
 * @param token 可选的token参数，如果不提供则从store中获取
 * @returns Promise<RoomListResponse>
 */
export const getRoomList = async (params: GetRoomListParams, token?: string): Promise<RoomListResponse> => {
  // 获取token，优先使用传入的token，否则从store中获取
  const authToken = token || useAuthStore.getState().getToken();
  
  if (!authToken) {
    throw new Error('未找到认证token');
  }

  try {
    // 构建查询参数
    const queryParams = new URLSearchParams({
      current: params.current.toString(),
      size: params.size.toString(),
    });

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ROOM_LIST}?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // token过期或无效，清除认证信息
        useAuthStore.getState().clearAuth();
        throw new Error('认证失败，请重新登录');
      }
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取房间列表失败:', error);
    throw error;
  }
};