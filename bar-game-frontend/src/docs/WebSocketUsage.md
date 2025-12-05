# WebSocket消息系统使用指南

## 概述

本项目基于后端统一消息格式规范实现了完整的WebSocket消息处理系统，支持动态注册消息处理器、请求-响应模式、自动重连等功能。

### TypeScript 配置说明

本项目启用了 `verbatimModuleSyntax` 和 `erasableSyntaxOnly` TypeScript 配置，因此：

1. **类型导入**：对于仅用作类型的导入，必须使用 `import type` 语法
   ```typescript
   import type { MessageModule } from '../types/websocketMessages'
   ```

2. **值导入**：对于在代码中实际使用的值，使用常规导入
   ```typescript
   import { StatusCode } from '../types/websocketMessages'
   ```

3. **枚举使用**：枚举被定义为 `const` 对象，而不是传统的 `enum`
   ```typescript
   // 正确
   if (response.code === StatusCode.SUCCESS) { ... }
   
   // 错误 - 不再支持
   if (response.code === 200) { ... }
   ```

## 消息格式

所有WebSocket消息都遵循统一格式：

```json
{
  "requestId": "string",    // 消息唯一标识（请求-响应模式必传）
  "module": "HALL|ROOM|GAME",  // 业务模块类型
  "cmd": "具体指令",          // 指令类型
  "code": 200,               // 状态码（默认200=成功）
  "msg": "success",          // 状态描述
  "data": {}                 // 业务数据体
}
```

## 基本使用

### 1. 注册消息处理器

```typescript
import { useEffect } from 'react'
import { useWebSocketMessage } from '../store/websocketStore'
import type { MessageModule } from '../types/websocketMessages'

const MyComponent = () => {
  const { registerHandler, unregisterHandler } = useWebSocketMessage()

  useEffect(() => {
    // 注册大厅模块的消息处理器
    registerHandler({
      module: MessageModule.HALL,
      cmd: 'USER_LIST',
      handler: (message) => {
        console.log('收到用户列表:', message.data)
        // 处理用户列表数据
      },
      description: '处理大厅用户列表更新'
    })

    // 注册房间模块的消息处理器
    registerHandler({
      module: MessageModule.ROOM,
      cmd: 'JOIN_ROOM',
      handler: (message) => {
        if (message.code === 200) {
          console.log('成功加入房间:', message.data)
        } else {
          console.error('加入房间失败:', message.msg)
        }
      },
      description: '处理加入房间结果'
    })

    // 组件卸载时注销处理器
    return () => {
      unregisterHandler(MessageModule.HALL, 'USER_LIST')
      unregisterHandler(MessageModule.ROOM, 'JOIN_ROOM')
    }
  }, [registerHandler, unregisterHandler])

  return <div>我的组件</div>
}
```

### 2. 发送消息

#### 发送请求（期待响应）

```typescript
import { useWebSocketSender } from '../store/websocketStore'
import type { MessageModule } from '../types/websocketMessages'
import { StatusCode } from '../types/websocketMessages'

const SendMessageExample = () => {
  const { sendMessage } = useWebSocketSender()

  const handleJoinRoom = async () => {
    try {
      const response = await sendMessage({
        module: MessageModule.ROOM,
        cmd: 'JOIN',
        code: StatusCode.SUCCESS,
        msg: '请求加入房间',
        data: {
          roomId: 'room123',
          password: 'optional_password'
        }
      })

      if (response.code === 200) {
        console.log('加入房间成功:', response.data)
      } else {
        console.error('加入房间失败:', response.msg)
      }
    } catch (error) {
      console.error('发送消息失败:', error)
    }
  }

  return (
    <button onClick={handleJoinRoom}>
      加入房间
    </button>
  )
}
```

#### 发送通知（不期待响应）

```typescript
import { useWebSocketSender } from '../store/websocketStore'
import type { MessageModule } from '../types/websocketMessages'
import { StatusCode } from '../types/websocketMessages'

const SendNotificationExample = () => {
  const { sendNotification } = useWebSocketSender()

  const handleSendMessage = () => {
    sendNotification({
      module: MessageModule.GAME,
      cmd: 'PLAYER_ACTION',
      code: StatusCode.SUCCESS,
      msg: '玩家动作',
      data: {
        action: 'move',
        position: { x: 100, y: 200 }
      }
    })
  }

  return (
    <button onClick={handleSendMessage}>
      发送玩家动作
    </button>
  )
}
```

### 3. 监听连接状态

```typescript
import { useWebSocketMessage } from '../store/websocketStore'

const ConnectionStatus = () => {
  const { isConnected, error } = useWebSocketMessage()

  return (
    <div>
      <p>连接状态: {isConnected ? '已连接' : '已断开'}</p>
      {error && <p style={{ color: 'red' }}>错误: {error}</p>}
    </div>
  )
}
```

## 完整示例

### 游戏大厅组件

```typescript
import { useEffect, useState } from 'react'
import { useWebSocketMessage, useWebSocketSender } from '../store/websocketStore'
import type { MessageModule } from '../types/websocketMessages'
import { StatusCode } from '../types/websocketMessages'

interface Room {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
}

const GameLobby = () => {
  const [rooms, setRooms] = useState<Room[]>([])
  const { registerHandler, unregisterHandler } = useWebSocketMessage()
  const { sendMessage } = useWebSocketSender()

  useEffect(() => {
    // 注册房间列表处理器
    registerHandler({
      module: MessageModule.HALL,
      cmd: 'ROOM_LIST',
      handler: (message) => {
        if (message.code === 200) {
          setRooms(message.data.rooms || [])
        }
      },
      description: '处理房间列表更新'
    })

    // 注册加入房间结果处理器
    registerHandler({
      module: MessageModule.ROOM,
      cmd: 'JOIN',
      handler: (message) => {
        if (message.code === 200) {
          console.log('成功加入房间:', message.data)
          // 跳转到游戏房间页面
        } else {
          alert(`加入房间失败: ${message.msg}`)
        }
      },
      description: '处理加入房间结果'
    })

    // 请求房间列表
    fetchRoomList()

    return () => {
      unregisterHandler(MessageModule.HALL, 'ROOM_LIST')
      unregisterHandler(MessageModule.ROOM, 'JOIN')
    }
  }, [registerHandler, unregisterHandler])

  const fetchRoomList = async () => {
    try {
      await sendMessage({
        module: MessageModule.HALL,
        cmd: 'GET_ROOMS',
        code: StatusCode.SUCCESS,
        msg: '获取房间列表'
      })
    } catch (error) {
      console.error('获取房间列表失败:', error)
    }
  }

  const handleJoinRoom = async (roomId: string) => {
    try {
      await sendMessage({
        module: MessageModule.ROOM,
        cmd: 'JOIN',
        code: StatusCode.SUCCESS,
        msg: '请求加入房间',
        data: { roomId }
      })
    } catch (error) {
      console.error('加入房间失败:', error)
    }
  }

  return (
    <div>
      <h2>游戏大厅</h2>
      <button onClick={fetchRoomList}>刷新房间列表</button>

      <div className="room-list">
        {rooms.map(room => (
          <div key={room.id} className="room-item">
            <h3>{room.name}</h3>
            <p>玩家: {room.playerCount}/{room.maxPlayers}</p>
            <button
              onClick={() => handleJoinRoom(room.id)}
              disabled={room.playerCount >= room.maxPlayers}
            >
              {room.playerCount >= room.maxPlayers ? '房间已满' : '加入房间'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GameLobby
```

## 高级用法

### 自定义消息处理器

```typescript
// 自定义消息类型
interface GameMoveMessage {
  playerId: string
  moveType: string
  position: { x: number, y: number }
  timestamp: number
}

// 注册带类型的处理器
registerHandler({
  module: MessageModule.GAME,
  cmd: 'PLAYER_MOVE',
  handler: (message) => {
    const gameData = message.data as GameMoveMessage
    console.log(`玩家 ${gameData.playerId} 移动到:`, gameData.position)

    // 更新游戏状态
    updateGameState(gameData)
  },
  description: '处理玩家移动'
})
```

### 错误处理

```typescript
const { sendMessage } = useWebSocketSender()

const handleSendMessage = async () => {
  try {
    const response = await sendMessage({
      module: MessageModule.ROOM,
      cmd: 'CREATE_ROOM',
      code: StatusCode.SUCCESS,
      msg: '创建房间',
      data: { roomName: '我的房间' }
    })

    // 检查业务错误
    if (response.code !== StatusCode.SUCCESS) {
      switch (response.code) {
        case StatusCode.BUSINESS_ERROR + 1: // 假设1001是房间名重复
          alert('房间名已存在')
          break
        default:
          alert(`操作失败: ${response.msg}`)
      }
      return
    }

    console.log('房间创建成功:', response.data)
  } catch (error: any) {
    if (error.message.includes('超时')) {
      alert('请求超时，请检查网络连接')
    } else if (error.message.includes('未连接')) {
      alert('网络连接已断开，请重新登录')
    } else {
      alert(`发送失败: ${error.message}`)
    }
  }
}
```

## 注意事项

1. **处理器管理**: 组件卸载时记得注销消息处理器，避免内存泄漏
2. **错误处理**: 始终检查消息的`code`字段，处理业务错误
3. **网络状态**: 使用`isConnected`状态来禁用相关UI操作
4. **类型安全**: 尽量为`data`字段定义具体的类型
5. **调试模式**: 开发环境下会自动启用调试日志

## 扩展新消息类型

当后端添加新的消息类型时，只需：

1. 在相应组件中注册新的消息处理器
2. 根据需要更新TypeScript类型定义
3. 添加相应的UI处理逻辑

例如，添加新的游戏状态同步消息：

```typescript
// 新的消息类型
interface GameStateSync {
  gameState: 'waiting' | 'playing' | 'finished'
  currentPlayer: string
  turnNumber: number
  gameData: any
}

// 注册处理器
registerHandler({
  module: MessageModule.GAME,
  cmd: 'STATE_SYNC',
  handler: (message) => {
    const gameState = message.data as GameStateSync
    updateGameUI(gameState)
  },
  description: '处理游戏状态同步'
})
```

这样就可以轻松扩展支持新的消息类型，无需修改核心WebSocket处理逻辑。