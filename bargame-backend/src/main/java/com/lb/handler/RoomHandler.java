package com.lb.handler;

import com.lb.message.WebSocketMsg;
import com.lb.message.enums.ModuleType;
import com.lb.service.imp.RoomService;
import com.lb.net.ConnectionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class RoomHandler {
    @Autowired
    private RoomService roomService;

    /**
     * 处理房间相关消息
     * @param msg WebSocket消息对象
     * @param connectionContext 连接上下文，封装了WebSocket连接的所有必要信息
     * @return WebSocketMsg<?> 响应消息（成功/错误），null 表示无需响应
     */
    public WebSocketMsg<?> handle(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        switch (msg.getCmd()) {
            case ROOM_JOIN -> {
                return roomService.joinRoom(msg, connectionContext);
            }
            case ROOM_LEAVE -> {
                return roomService.leaveRoom(msg, connectionContext);
            }
            case PLAYER_PREPARE -> {
                return roomService.playerPrepare(msg, connectionContext);
            }
            case PLAYER_CANCEL_PREPARE -> {
                return roomService.playerCancelPrepare(msg, connectionContext);
            }
            // WebRTC 语音通话相关命令
            case WEBRTC_OFFER -> {
                return roomService.handleWebRTCOffer(msg, connectionContext);
            }
            case WEBRTC_ANSWER -> {
                return roomService.handleWebRTCAnswer(msg, connectionContext);
            }
            case WEBRTC_ICE_CANDIDATE -> {
                return roomService.handleWebRTCIceCandidate(msg, connectionContext);
            }
            default -> {
                log.warn("房间模块不支持的指令：cmd={}, requestId={}, connectionId={}",
                    msg.getCmd(), msg.getRequestId(), connectionContext.getId());
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.ROOM,
                        msg.getCmd(),
                        400,
                        "不支持的指令：" + msg.getCmd()
                );
            }
        }
    }
}
