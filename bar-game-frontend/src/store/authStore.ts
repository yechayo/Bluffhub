import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// 用户信息接口 - 支持动态扩展
export interface User {
  userId: number
  username: string
  sessionId: string | null
  playerStatus: string
  locationType: string
  playerRole: string | null
  seatNumber: number
  isOwner: boolean
  isReady: boolean
  connectionStatus: string
  isAlive: boolean | null
  score: number | null
  winCount: number | null
  loseCount: number | null
  handCards: any[] | null
  actionHistory: any[] | null
  playerData: any | null
  lastActiveTime: string
  joinTime: string
  lastActionTime: string | null
  tempFlag: any | null
  createdAt: string | null
  updatedAt: string | null
  alive: boolean
  prepared: boolean
  statusDescription: string
  online: boolean
  roomId: number | null
  nickName: string
  locationDescription: string
  inLobby: boolean
  inGame: boolean
  timeout: boolean
  roomOwner: boolean
  winRate: number
  inRoom: boolean
  roleModelInfo: any | null
  [key: string]: any // 支持任意额外字段
}

// 认证状态接口
interface AuthState {
  // 基础认证状态
  token: string | null
  isAuthenticated: boolean
  user: User | null

  // 初始化标记，用于避免刷新时的短暂未登录误判
  isInitializing: boolean

  // 认证相关方法
  login: (token: string, user?: User) => void
  logout: () => void
  updateUser: (userData: Partial<User>) => void
  updateUserField: (field: string, value: any) => void
  setToken: (token: string) => void
  clearAuth: () => void

  // 初始化控制
  finishInitialize: () => void

  // 获取token
  getToken: () => string | null
}

// 创建认证状态管理
export const useAuthStore = create<AuthState>()(devtools((set, get) => ({
  // 初始状态
  token: null,
  isAuthenticated: false,
  user: null,
  isInitializing: true,

  // 登录方法
  login: (token: string, user?: User) => {
    set({
      token,
      isAuthenticated: true,
      user: user || null,
      isInitializing: false
    })
  },

  // 登出方法
  logout: () => {
    set({
      token: null,
      isAuthenticated: false,
      user: null,
      isInitializing: false
    })
    // 清除localStorage
    localStorage.removeItem('BargameToken')
  },

  // 更新用户信息
  updateUser: (userData: Partial<User>) => {
    const currentUser = get().user
    if (currentUser) {
      set({
        user: { ...currentUser, ...userData }
      })
    } else {
      // 如果当前没有用户信息，直接设置（假设传入的是完整用户数据）
      set({
        user: userData as User
      })
    }
  },

  // 更新用户单个字段 - 支持动态字段
  updateUserField: (field: string, value: any) => {
    const currentUser = get().user
    if (currentUser) {
      set({
        user: { ...currentUser, [field]: value }
      })
    }
  },

  // 设置token
  setToken: (token: string) => {
    set({ token })
    // 同时更新localStorage
    localStorage.setItem('BargameToken', token)
  },

  // 清除认证信息
  clearAuth: () => {
    set({
      token: null,
      isAuthenticated: false,
      user: null,
      isInitializing: false
    })
    localStorage.removeItem('BargameToken')
  },

  // 获取token
  getToken: (): string | null => {
    const { token } = get()
    return token || localStorage.getItem('BargameToken')
  },

  // 结束初始化标记
  finishInitialize: () => {
    set({ isInitializing: false })
  }
})))

// 初始化认证状态 - 检查localStorage中的token
export const initializeAuth = (): void => {
  const token = localStorage.getItem('BargameToken')
  if (token) {
    useAuthStore.getState().setToken(token)
    useAuthStore.setState({ isAuthenticated: true, isInitializing: false })
  } else {
    useAuthStore.getState().finishInitialize()
  }
}

// 导出默认的认证store hook
export default useAuthStore