# WebRTC语音通话功能 - 后端API改动文档

## 概述

本文档描述了为支持WebRTC语音通话功能，后端需要实现的WebSocket消息处理逻辑。客户端使用WebRTC技术实现点对点语音通话，后端需要负责信令消息的转发。

## 消息流程概述

WebRTC语音通话的基本流程如下：

1. 用户A发起与用户B的连接请求
2. 用户A创建offer，通过WebSocket发送给服务器
3. 服务器将offer转发给用户B
4. 用户B收到offer后创建answer，通过WebSocket发送给服务器
5. 服务器将answer转发给用户A
6. 双方交换ICE候选信息，建立连接
7. 连接建立后，双方可以直接进行语音通信

## 需要实现的消息类型

后端需要处理以下三种WebRTC信令消息：

1. `WEBRTC_OFFER` - 连接发起方发送的offer消息
2. `WEBRTC_ANSWER` - 连接接收方回复的answer消息
3. `WEBRTC_ICE_CANDIDATE` - ICE候选信息

## 消息格式

所有WebRTC相关的消息都应使用以下统一格式：

```typescript
{
  requestId: string, // 消息唯一标识
  module: 'ROOM',
  cmd: 'WEBRTC_OFFER' | 'WEBRTC_ANSWER' | 'WEBRTC_ICE_CANDIDATE',
  code: 200,
  msg: 'success',
  data: {
    from: string,    // 发送方用户ID
    to: string,      // 接收方用户ID
    data: any        // WebRTC信令数据
  }
}
```

## 详细消息处理逻辑

### 1. WEBRTC_OFFER 消息处理

**客户端发送格式：**
```json
{
  "requestId": "webrtc_1234567890_abcdef123",
  "module": "ROOM",
  "cmd": "WEBRTC_OFFER",
  "code": 200,
  "msg": "success",
  "data": {
    "from": "user_123",
    "to": "user_456",
    "data": {
      "type": "offer",
      "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
    }
  }
}
```

**后端处理逻辑：**
1. 验证发送方和接收方是否在同一房间内
2. 验证发送方是否有权限发起语音连接
3. 将消息转发给目标用户（to字段指定的用户）

**后端转发给接收方的消息格式：**
```json
{
  "requestId": "webrtc_1234567890_abcdef123",
  "module": "ROOM",
  "cmd": "WEBRTC_OFFER",
  "code": 200,
  "msg": "success",
  "data": {
    "from": "user_123",
    "to": "user_456",
    "data": {
      "type": "offer",
      "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
    }
  }
}
```

### 2. WEBRTC_ANSWER 消息处理

**客户端发送格式：**
```json
{
  "requestId": "webrtc_1234567891_bcdef456",
  "module": "ROOM",
  "cmd": "WEBRTC_ANSWER",
  "code": 200,
  "msg": "success",
  "data": {
    "from": "user_456",
    "to": "user_123",
    "data": {
      "type": "answer",
      "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
    }
  }
}
```

**后端处理逻辑：**
1. 验证发送方和接收方是否在同一房间内
2. 验证是否之前有对应的offer消息
3. 将消息转发给目标用户（to字段指定的用户）

**后端转发给接收方的消息格式：**
```json
{
  "requestId": "webrtc_1234567891_bcdef456",
  "module": "ROOM",
  "cmd": "WEBRTC_ANSWER",
  "code": 200,
  "msg": "success",
  "data": {
    "from": "user_456",
    "to": "user_123",
    "data": {
      "type": "answer",
      "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
    }
  }
}
```

### 3. WEBRTC_ICE_CANDIDATE 消息处理

**客户端发送格式：**
```json
{
  "requestId": "webrtc_1234567892_cdef789",
  "module": "ROOM",
  "cmd": "WEBRTC_ICE_CANDIDATE",
  "code": 200,
  "msg": "success",
  "data": {
    "from": "user_123",
    "to": "user_456",
    "data": {
      "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  }
}
```

**后端处理逻辑：**
1. 验证发送方和接收方是否在同一房间内
2. 验证双方是否已建立WebRTC连接（有对应的offer/answer交换）
3. 将消息转发给目标用户（to字段指定的用户）

**后端转发给接收方的消息格式：**
```json
{
  "requestId": "webrtc_1234567892_cdef789",
  "module": "ROOM",
  "cmd": "WEBRTC_ICE_CANDIDATE",
  "code": 200,
  "msg": "success",
  "data": {
    "from": "user_123",
    "to": "user_456",
    "data": {
      "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  }
}
```

## 错误处理

当出现错误时，后端应返回相应的错误消息：

```json
{
  "module": "ROOM",
  "cmd": "WEBRTC_OFFER" | "WEBRTC_ANSWER" | "WEBRTC_ICE_CANDIDATE",
  "code": 400 | 500 | 1000,
  "msg": "错误描述",
  "data": null
}
```

常见错误情况：
- 用户不在同一房间内（code: 1000, msg: "用户不在同一房间内"）
- 目标用户不在线（code: 1000, msg: "目标用户不在线"）
- 没有对应的offer/answer（code: 1000, msg: "没有对应的连接请求"）
- 服务器内部错误（code: 500, msg: "服务器内部错误"）

## 实现建议

1. **消息路由**：后端需要实现基于用户ID的消息路由功能，将消息准确转发给目标用户

2. **状态管理**：建议维护WebRTC连接状态，记录哪些用户之间正在建立连接

3. **权限验证**：验证用户是否有权限发起语音连接（例如，是否在同一房间内）

4. **消息日志**：记录WebRTC信令消息，便于调试和问题排查

5. **超时处理**：对于长时间未完成的连接，可以实现超时清理机制

## 注意事项

1. WebRTC信令消息不需要后端处理具体内容，只需转发即可

2. 后端不需要理解SDP或ICE候选的具体内容，这些是WebRTC协议的一部分

3. 确保消息转发的实时性，避免延迟导致连接建立失败

4. 考虑实现连接状态管理，以便在用户断开连接时清理相关资源

## 测试建议

1. 测试同一房间内用户之间的信令消息转发

2. 测试不同房间用户之间的消息拒绝情况

3. 测试用户离线时的错误处理

4. 测试高并发场景下的消息转发性能

5. 测试网络不稳定情况下的消息重传机制（如果需要）