import { useCallback } from 'react'
import { useRoomStore } from '../store/roomStore'
import { createRoom } from '../utils/createRoom'
import type { CreateRoomParams } from '../utils/createRoom'

// 房间操作的自定义Hook
export const useRoomActions = () => {
  const {
    clearRoom,
    addPlayer,
    removePlayer,
    updatePlayer
  } = useRoomStore()

  // 创建房间
  const handleCreateRoom = useCallback(async (params: CreateRoomParams) => {
    try {
      const roomData = await createRoom(params)
      // createRoom 函数内部已经调用了 setCurrentRoom
      return roomData
    } catch (error: any) {
      throw error
    }
  }, [])

  // 离开房间
  const handleLeaveRoom = useCallback(() => {
    clearRoom()
  }, [clearRoom])

  // 更新玩家准备状态
  const togglePlayerReady = useCallback((playerId: number) => {
    const { currentRoom } = useRoomStore.getState()
    if (currentRoom && currentRoom.players) {
      const player = currentRoom.players.find(p => p.playerId === playerId)
      if (player) {
        updatePlayer(playerId, { isPrepared: !player.isPrepared })
      }
    }
  }, [updatePlayer])

  return {
    createRoom: handleCreateRoom,
    leaveRoom: handleLeaveRoom,
    togglePlayerReady,
    addPlayer,
    removePlayer,
    updatePlayer
  }
}

export default useRoomActions