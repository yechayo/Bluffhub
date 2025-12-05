import { create } from 'zustand'
import type { CreateRoomResponse, PlayerVO } from '../utils/createRoom'
import { devtools } from 'zustand/middleware'

// 房间状态接口
interface RoomState {
  // 当前房间信息
  currentRoom: CreateRoomResponse | null
}

// 房间操作接口
interface RoomActions {
  // 设置当前房间
  setCurrentRoom: (room: CreateRoomResponse | null) => void
  
  // 更新房间信息
  updateRoom: (roomData: Partial<CreateRoomResponse>) => void
  
  // 添加玩家到房间
  addPlayer: (player: PlayerVO) => void
  
  // 移除玩家
  removePlayer: (playerId: number) => void
  
  // 更新玩家信息
  updatePlayer: (playerId: number, playerData: Partial<PlayerVO>) => void
  
  // 清空房间信息
  clearRoom: () => void
}

// 创建房间状态管理
export const useRoomStore = create<RoomState & RoomActions>()(devtools((set, get) => ({
  // 初始状态
  currentRoom: null,

  // 设置当前房间
  setCurrentRoom: (room: CreateRoomResponse | null) => {
    set({ currentRoom: room })
  },

  // 更新房间信息
  updateRoom: (roomData: Partial<CreateRoomResponse>) => {
    const { currentRoom } = get()
    if (currentRoom) {
      set({
        currentRoom: { ...currentRoom, ...roomData }
      })
    }
  },

  // 添加玩家到房间
  addPlayer: (player: PlayerVO) => {
    const { currentRoom } = get()
    if (currentRoom && currentRoom.players) {
      const updatedPlayers = [...currentRoom.players, player]
      const currentPlayerCount = updatedPlayers.length
      const availableSlots = currentRoom.maxPlayers ? currentRoom.maxPlayers - currentPlayerCount : 0
      
      set({
        currentRoom: {
          ...currentRoom,
          players: updatedPlayers,
          currentPlayerCount,
          availableSlots
        }
      })
    }
  },

  // 移除玩家
  removePlayer: (playerId: number) => {
    const { currentRoom } = get()
    if (currentRoom && currentRoom.players) {
      const updatedPlayers = currentRoom.players.filter(p => p.playerId !== playerId)
      const currentPlayerCount = updatedPlayers.length
      const availableSlots = currentRoom.maxPlayers ? currentRoom.maxPlayers - currentPlayerCount : 0
      
      set({
        currentRoom: {
          ...currentRoom,
          players: updatedPlayers,
          currentPlayerCount,
          availableSlots
        }
      })
    }
  },

  // 更新玩家信息
  updatePlayer: (playerId: number, playerData: Partial<PlayerVO>) => {
    const { currentRoom } = get()
    if (currentRoom && currentRoom.players) {
      const updatedPlayers = currentRoom.players.map(p => 
        p.playerId === playerId ? { ...p, ...playerData } : p
      )
      
      set({
        currentRoom: {
          ...currentRoom,
          players: updatedPlayers
        }
      })
    }
  },

  // 清空房间信息
  clearRoom: () => {
    set({ currentRoom: null })
  }
})))

// 导出便捷hooks
export const useCurrentRoom = () => {
  const currentRoom = useRoomStore(state => state.currentRoom)
  
  return {
    currentRoom
  }
}

export const useRoomPlayers = () => {
  const players = useRoomStore(state => state.currentRoom?.players || [])
  const currentPlayerCount = useRoomStore(state => state.currentRoom?.currentPlayerCount || 0)
  const maxPlayers = useRoomStore(state => state.currentRoom?.maxPlayers || 0)
  const availableSlots = useRoomStore(state => state.currentRoom?.availableSlots || 0)
  
  return {
    players,
    currentPlayerCount,
    maxPlayers,
    availableSlots
  }
}

export default useRoomStore