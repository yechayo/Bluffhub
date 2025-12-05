package com.lb.handler;

import com.lb.message.WebSocketMsg;
import com.lb.message.enums.ModuleType;
import com.lb.service.imp.SystemService;
import com.lb.net.ConnectionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 系统模块处理器
 * 处理心跳等系统级消息
 *
 * @author LiarBar
 * @version 1.0
 */
@Component
@Slf4j
public class SystemHandler {

    @Autowired
    private SystemService systemService;

    /**
     * 处理系统模块消息
     * @param msg WebSocket消息对象
     * @param connectionContext 连接上下文，封装了WebSocket连接的所有必要信息
     * @return WebSocketMsg<?> 响应消息（成功/错误），null 表示无需响应
     */
    public WebSocketMsg<?> handle(WebSocketMsg<?> msg, ConnectionContext connectionContext) {

        switch (msg.getCmd()) {
            case HEARTBEAT -> {
                return systemService.heartbeat(msg, connectionContext);
            }

            default -> {
                log.warn("系统模块不支持的指令：cmd={}, requestId={}, connectionId={}",
                        msg.getCmd(), msg.getRequestId(), connectionContext.getId());
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.SYSTEM,
                        msg.getCmd(),
                        400,
                        "不支持的指令：" + msg.getCmd()
                );
            }
        }
    }
}