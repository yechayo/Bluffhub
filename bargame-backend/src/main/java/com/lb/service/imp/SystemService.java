package com.lb.service.imp;

import com.lb.message.WebSocketMsg;
import com.lb.message.enums.CmdType;
import com.lb.message.enums.ModuleType;
import com.lb.net.ConnectionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 系统模块服务
 * 处理心跳等系统级消息的业务逻辑
 *
 * @author LiarBar
 * @version 1.0
 */
@Slf4j
@Service
public class SystemService {

    /**
     * 处理心跳消息
     * @param msg WebSocket消息对象
     * @param connectionContext 连接上下文，封装了WebSocket连接的所有必要信息
     * @return WebSocketMsg<?> 响应消息（成功/错误），null 表示无需响应
     */
    public WebSocketMsg<?> heartbeat(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        log.debug("收到心跳消息: connectionId={}", connectionContext.getId());
        return WebSocketMsg.push(ModuleType.SYSTEM, CmdType.HEARTBEAT, null);
    }
}