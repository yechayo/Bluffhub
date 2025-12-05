package com.lb.dispatcher;

import com.lb.handler.GameHandler;
import com.lb.handler.HallHandler;
import com.lb.handler.RoomHandler;
import com.lb.handler.SystemHandler;
import com.lb.message.WebSocketMsg;
import com.lb.net.ConnectionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class Dispatcher {

    @Autowired
    private HallHandler hallHandler;
    @Autowired
    private RoomHandler roomHandler;
    @Autowired
    private GameHandler gameHandler;
    @Autowired
    private SystemHandler systemHandler;


    /**
     * 按模块分发消息，返回需要响应给前端的消息
     *
     * @param msg               WebSocket消息对象
     * @param connectionContext 连接上下文，封装了WebSocket连接的所有必要信息
     * @return WebSocketMsg<?> 响应消息（成功/错误），null 表示无需响应
     */
    public WebSocketMsg<?> dispatch(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
                // 增加接收消息计数
        connectionContext.incrementReceivedMessageCount();

        // 按模块分发，返回响应消息
        switch (msg.getModule()) {
            case HALL -> {
                return hallHandler.handle(msg, connectionContext);
            }
            case ROOM -> {
                return roomHandler.handle(msg, connectionContext);
            }
            case GAME -> {
                return gameHandler.handle(msg, connectionContext);
            }
            case SYSTEM -> {
                return systemHandler.handle(msg, connectionContext);
            }
            default -> {
                log.warn("未知的模块类型：module={}, connectionId={}", msg.getModule(), connectionContext.getId());
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        msg.getModule(),
                        msg.getCmd(),
                        400,
                        "不支持的业务模块：" + msg.getModule()
                );
            }
        }
    }
}