package com.lb.service.imp;

import com.lb.entity.Player;
import com.lb.message.vo.hall.OnlineListResponse;
import com.lb.message.WebSocketMsg;
import com.lb.message.enums.CmdType;
import com.lb.message.enums.ModuleType;
import com.lb.manager.ConnectionManager;
import com.lb.net.ConnectionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
@Slf4j
public class HallService {

    @Autowired
    private ConnectionManager connectionManager;

    /**
     * 返回向用户返回当前玩家列表
     *
     * @param msg WebSocket消息对象
     * @param connectionContext 连接上下文，封装了WebSocket连接的所有必要信息
     * @return WebSocketMsg<?> 响应消息
     */
    public WebSocketMsg<?> onlineList(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 获取所有在线玩家
            List<Player> onlinePlayers = connectionManager.getAllOnlinePlayers();

            // 构建在线用户数据
            List<OnlineListResponse.OnlineUserVO> onlineUserData = onlinePlayers.stream()
                .filter(player -> player.getUsername() != null && !player.getUsername().trim().isEmpty())
                .map(player -> {
                    OnlineListResponse.OnlineUserVO userInfo = new OnlineListResponse.OnlineUserVO();
                    userInfo.setUserId(player.getUserId());
                    userInfo.setUsername(player.getUsername());
                    userInfo.setStatus(player.getStatusDescription());
                    userInfo.setLocation(player.getLocationDescription());
                    userInfo.setNickName(player.getNickName());
                    return userInfo;
                })
                .collect(Collectors.toList());

            // 构建响应数据
            OnlineListResponse responseData = new OnlineListResponse();
            responseData.setOnlineCount(onlineUserData.size());
            responseData.setOnlineUsers(onlineUserData);

            // 构建响应消息
            WebSocketMsg<OnlineListResponse> responseMessage = WebSocketMsg.response(
                msg.getRequestId(),
                ModuleType.HALL,
                CmdType.ONLINE_LIST,
                responseData
            );

            log.info("处理在线用户列表请求完成: 在线人数={}", onlineUserData.size());
            return responseMessage;

        } catch (Exception e) {
            log.error("处理在线用户列表请求时发生异常: error={}", e.getMessage(), e);

            // 返回错误响应
            return WebSocketMsg.error(
                msg.getRequestId(),
                ModuleType.HALL,
                CmdType.ONLINE_LIST,
                500,
                "获取在线用户列表失败: " + e.getMessage()
            );
        }
    }
}
