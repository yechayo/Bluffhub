/**
 * WebSocket消息类型定义
 * 基于后端统一消息格式规范
 */

// 业务模块类型
export const MessageModule = {
  HALL: 'HALL',    // 大厅模块
  ROOM: 'ROOM',    // 房间模块
  GAME: 'GAME',    // 游戏模块
  SYSTEM: 'SYSTEM' // 系统模块（心跳、通知等）
} as const;

export type MessageModule = typeof MessageModule[keyof typeof MessageModule];

// 状态码枚举
export const StatusCode = {
  SUCCESS: 200,           // 成功
  PARAM_ERROR: 400,       // 参数错误
  FORBIDDEN: 403,         // 无权限
  SERVER_ERROR: 500,      // 服务器错误
  BUSINESS_ERROR: 1000    // 业务异常起始值
} as const;

export type StatusCode = typeof StatusCode[keyof typeof StatusCode];

// 基础消息结构
export interface BaseWebSocketMessage {
  requestId?: string;      // 消息唯一标识（请求-响应模式必传）
  module: MessageModule;   // 业务模块类型
  cmd: string;             // 指令类型
  code: StatusCode;        // 状态码
  msg: string;             // 状态描述
  data?: any;              // 业务数据体
}

// 请求消息结构（需要requestId）
export interface WebSocketRequest extends BaseWebSocketMessage {
  requestId: string;       // 请求消息必须有requestId
  module: MessageModule;
  cmd: string;
  code: StatusCode;        // 请求消息通常为200
  msg: string;
  data?: any;
}

// 响应消息结构（与请求的requestId对应）
export interface WebSocketResponse extends BaseWebSocketMessage {
  requestId: string;       // 响应消息的requestId与请求对应
  module: MessageModule;
  cmd: string;
  code: StatusCode;
  msg: string;
  data?: any;
}

// 服务器推送消息结构（不需要requestId）
export interface WebSocketNotification extends BaseWebSocketMessage {
  module: MessageModule;
  cmd: string;
  code: StatusCode;
  msg: string;
  data?: any;
}

// 联合类型：所有可能的WebSocket消息
export type WebSocketMessage = WebSocketRequest | WebSocketResponse | WebSocketNotification;

// 消息处理器类型
export type MessageHandler<T = any> = (message: WebSocketMessage & { data?: T }) => void | Promise<void>;

// 消息处理器配置
export interface MessageHandlerConfig {
  module: MessageModule;
  cmd: string;
  handler: MessageHandler;
  description?: string;     // 处理器描述，便于调试
}

// 请求-响应对，用于处理异步请求
export interface PendingRequest {
  resolve: (response: WebSocketMessage) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// WebSocket连接状态
export const WebSocketStatus = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
} as const;

export type WebSocketStatus = typeof WebSocketStatus[keyof typeof WebSocketStatus];

// 消息发送配置
export interface SendMessageOptions {
  timeout?: number;        // 请求超时时间（毫秒），默认5000
  expectResponse?: boolean; // 是否期待响应，默认true
}

// ==================== 房间模块消息类型 ====================

// 退出房间请求参数
export interface RoomLeaveRequest {
  roomId: number;
}

// 退出房间响应数据
export interface RoomLeaveResponse {
  success: boolean;
  message?: string;
  roomId?: number;
}

// 加入房间请求参数
export interface RoomJoinRequest {
  roomId: number;
}

// 加入房间响应数据
export interface RoomJoinResponse {
  roomId: number;
  roomName: string;
  ownerId: number;
  roomStatus: string;
  gameModeName: string;
  currentPlayerCount: number;
  maxPlayers: number;
  availableSlots: number;
  isPrivate: boolean;
  description?: string;
  players: Array<{
    playerId: number;
    nickname: string;
    status: string;
    avatar?: string;
    isPrepared: boolean;
    isOwner: boolean;
  }>;
  createdAt: string;
  backgroundMusic?: string;
  extConfig?: string;
}

// 房间成员推送更新数据
export interface RoomMembersPushData {
  roomId: number;
  roomName: string;
  ownerId: number;
  roomStatus: string;
  gameModeName: string;
  currentPlayerCount: number;
  maxPlayers: number;
  availableSlots: number;
  isPrivate: boolean;
  description?: string;
  players: Array<{
    playerId: number;
    nickname: string;
    status: string;
    avatar?: string;
    isPrepared: boolean;
    isOwner: boolean;
  }>;
  createdAt: string;
  backgroundMusic?: string;
  extConfig?: string;
}

// 房间消息命令常量
export const RoomCommand = {
  // 房间管理
  ROOM_LEAVE: 'ROOM_LEAVE',     // 退出房间
  ROOM_JOIN: 'ROOM_JOIN',       // 加入房间
  ROOM_CREATE: 'ROOM_CREATE',   // 创建房间
  ROOM_LIST: 'ROOM_LIST',       // 房间列表
  ROOM_INFO: 'ROOM_INFO',       // 房间信息
  
  // 房间内操作
  ROOM_PREPARE: 'ROOM_PREPARE', // 准备游戏
  ROOM_START: 'ROOM_START',     // 开始游戏
  ROOM_KICK: 'ROOM_KICK',       // 踢出玩家
  
  // 房间状态更新
  ROOM_UPDATE: 'ROOM_UPDATE',   // 房间信息更新
  ROOM_MEMBERS_PUSH: 'ROOM_MEMBERS_PUSH', // 房间成员推送更新
  PLAYER_JOIN: 'PLAYER_JOIN',   // 玩家加入
  PLAYER_LEAVE: 'PLAYER_LEAVE', // 玩家离开
  PLAYER_PREPARE: 'PLAYER_PREPARE', // 玩家准备状态变化
  PLAYER_CANCEL_PREPARE: 'PLAYER_CANCEL_PREPARE', // 玩家取消准备
} as const;

export type RoomCommand = typeof RoomCommand[keyof typeof RoomCommand];

// ==================== 游戏模块消息类型 ====================

export interface StartGameRequest {
  roomId: number;
}

export const GameCommand = {
  START_GAME: 'START_GAME',
  PLAYER_SEATS: 'PLAYER_SEATS',
  GAME_STARTED: 'GAME_STARTED',
  PLAY_CARDS: 'PLAY_CARDS',          // 玩家出牌
  PLAYER_PLAYED: 'PLAYER_PLAYED'     // 玩家出牌广播
  ,
  // 质疑相关
  CHALLENGE: 'CHALLENGE',
  CHALLENGE_RESULT: 'CHALLENGE_RESULT',
  
  // 游戏流程
  NEW_ROUND: 'NEW_ROUND',
  GAME_FINISHED: 'GAME_FINISHED',
  LEAVE_GAME: 'LEAVE_GAME',
  GAME_LEAVE: 'GAME_LEAVE'
} as const;

export type GameCommand = typeof GameCommand[keyof typeof GameCommand];

// 游戏开始时的玩家座位布局广播数据
export interface PlayerSeatsData {
  gameId: number;
  playerIds: number[]; // 按座位顺序排列的玩家ID，索引即座位号
}

// 卡牌类型
export interface Card {
  type: string; // 卡牌类型：Q/K/A/JOKER
  suit?: string; // 花色：HEARTS/SPADES/CLUBS/DIAMONDS（可选，部分游戏不需要花色）
}

// 游戏玩家信息（包含私有信息如手牌）
export interface GamePlayer {
  playerId: number;
  userId?: number;
  nickname?: string;
  handCards: Card[]; // 手牌
  alive: boolean; // 是否存活
  bullets?: number; // 子弹数
  bulletsUsed?: boolean; // 是否已使用子弹
}

// 游戏开始通知数据（个性化，每个玩家收到自己的手牌）
export interface GameStartedData {
  gameId: number;
  gamePlayers: GamePlayer; // 当前玩家的游戏信息
  firstPlayerId: number; // 第一个出牌的玩家ID
  targetCardType: string; // 本轮目标牌类型（Q/K/A）
  roundNumber: number; // 当前轮次编号
}

// 玩家出牌请求数据
export interface PlayCardsRequest {
  gameId: number;
  cards: string[]; // 要出的牌列表（字符串数组）
}

// 质疑请求
export interface ChallengeRequest {
  gameId: number;
}

// 质疑结果推送数据
export interface ChallengeResultData {
  gameId: number;
  roundNumber: number;
  lastPlayerId: number; // 上家出牌玩家ID
  playedCards: string[]; // 上家出的真实牌面
  loserId: number; // 质疑失败的玩家ID（开枪者）
  loserDead: boolean; // 输家是否死亡
}

// 玩家出牌广播数据
export interface PlayerPlayedData {
  gameId: number;
  roundNumber: number; // 当前轮次
  playerId: number; // 出牌玩家ID
  cardsCount: number; // 出牌数量
  remainingCards: number; // 该玩家剩余手牌数量
  nextPlayerId: number; // 下一个出牌玩家ID
}

// 新一轮通知数据
export interface NewRoundData {
  gameId: number;
  gamePlayers: GamePlayer; // 当前玩家的游戏信息（包含新手牌）
  firstPlayerId: number; // 第一个出牌的玩家ID
  targetCardType: string; // 本轮目标牌类型
  roundNumber: number; // 新的轮次编号
}

// 游戏结束通知数据
export interface GameFinishedData {
  gameId: number;
  playerId: number | null; // 获胜者玩家ID（平局为null）
  totalRounds: number; // 游戏总轮数
}

// 离开游戏请求
export interface LeaveGameRequest {
  gameId: number;
}

// 玩家离开游戏广播数据
export interface GameLeaveData {
  gameId: number;
  roundNumber: number;
  leavePlayerId: number;
}

// ==================== 系统模块消息类型 ====================

// 系统命令常量
export const SystemCommand = {
  HEARTBEAT: 'HEARTBEAT',
  RECONNECT: 'RECONNECT'
} as const;

export type SystemCommand = typeof SystemCommand[keyof typeof SystemCommand];

// 在线用户信息（重连同步）
export interface ReconnectOnlineUser {
  userId: number;
  username: string;
  status: string;
  location: string;
  nickName: string;
}

// 在线列表响应（重连同步）
export interface ReconnectOnlineListResponse {
  onlineCount: number;
  onlineUsers: ReconnectOnlineUser[];
}

// 重连时的房间玩家信息
export interface ReconnectRoomPlayer {
  playerId: number;
  nickname: string;
  status: string;
  avatar?: string | null;
  isPrepared: boolean;
  isOwner: boolean;
}

// 重连时的游戏玩家信息（当前玩家私有信息）
export interface ReconnectGamePlayer {
  playerId: number;
  userId?: number;
  nickname?: string;
  handCards: Card[] | string[]; // 手牌，支持对象数组或字符串数组
  alive: boolean;
  bullets?: number; // 子弹数（部分后端返回 bulletCount）
  bulletCount?: number; // 兼容后端字段名
  bulletsUsed?: boolean;
}

// 房间状态枚举（用于重连）
export const ReconnectRoomStatus = {
  WAITING: 'WAITING',
  PLAYING: 'PLAYING',
  FINISHED: 'FINISHED'
} as const;

export type ReconnectRoomStatus = typeof ReconnectRoomStatus[keyof typeof ReconnectRoomStatus];

// 重连同步消息数据结构
export interface SystemReconnectPayload {
  // 在线列表（所有重连用户都会收到）
  onlineListResponse: ReconnectOnlineListResponse;

  // 房间信息（如果用户在房间中）
  roomId?: number | null;
  roomName?: string;
  ownerId?: number;
  roomStatus?: ReconnectRoomStatus;
  gameModeName?: string;
  currentPlayerCount?: number;
  maxPlayers?: number;
  availableSlots?: number;
  isPrivate?: boolean;
  description?: string | null;
  players?: ReconnectRoomPlayer[];

  // 游戏信息（如果用户在游戏中）
  gameId?: number | null;
  gamePlayers?: ReconnectGamePlayer; // 当前玩家的游戏信息（包含手牌等私有信息）
  firstPlayerId?: number;
  targetCardType?: string;
  roundNumber?: number;
  playerIds?: number[]; // 游戏中所有玩家ID列表（按座位顺序）
  handCards?: number[]; // 其他玩家手牌数量列表（按座位顺序对应playerIds）
  bulletCounts?: number[]; // 其他玩家子弹数量列表（按座位顺序对应playerIds）
}