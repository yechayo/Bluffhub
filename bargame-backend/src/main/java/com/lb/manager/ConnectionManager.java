package com.lb.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lb.entity.Player;
import com.lb.message.vo.hall.OnlineListResponse;
import com.lb.message.WebSocketMsg;
import com.lb.message.enums.CmdType;
import com.lb.message.enums.ModuleType;
import com.lb.net.ConnectionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket连接管理器
 * 职责：管理WebSocket连接，负责底层的连接生命周期管理
 * 注意：用户状态管理已移至UserStateManager，此类只负责连接管理
 *
 * @author LiarBar
 * @version 2.0
 */
@Slf4j
@Component
public class ConnectionManager {

    // 纯连接管理：只管理物理连接
    private final Map<String, ConnectionContext> connections = new ConcurrentHashMap<>(); // connectionId -> ConnectionContext

    // 用户状态管理器
    @Autowired
    private UserStateManager userStateManager;

    // ObjectMapper用于JSON序列化
    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 初始化连接管理器
     */
    public ConnectionManager() {
        log.info("ConnectionManager初始化完成");
    }

    // ==================== 连接管理核心方法 ====================

    /**
     * 添加新连接
     * 处理连接建立，将用户状态与连接关联
     *
     * @param connectionId 连接ID（通常使用Session.getId()）
     * @param connectionContext 连接上下文
     * @param player 玩家对象
     * @return 是否为新连接，false表示重复连接
     */
    public boolean addConnection(String connectionId, ConnectionContext connectionContext, Player player) {
        // 1. 检查用户是否已有连接（重复连接）
        if (userStateManager.isUserOnline(player.getUserId())) {
            String oldConnectionId = userStateManager.getConnectionIdByUserId(player.getUserId());
            log.info("玩家[{}]重复连接，移除旧连接: {}", player.getUserId(), oldConnectionId);

            // 移除旧连接（但保留用户状态）
            removeConnection(oldConnectionId); //TODO此处进行了重复连接判断因此可以做重连挤下线功能
        }

        // 2. 添加物理连接
        connections.put(connectionId, connectionContext);

        // 3. 更新用户状态管理器
        userStateManager.addOrUpdateUserState(player.getUserId(), player);
        userStateManager.userOnline(player.getUserId(), connectionId);

        log.info("新连接建立: connectionId={}, userId={}, 状态={}",
                connectionId, player.getUserId(), player.getStatusDescription());

        return true;
    }

    /**
     * 移除连接
     * 处理连接断开，但保留用户状态
     *
     * @param connectionId 连接ID
     * @return 断开连接的用户ID，如果连接不存在则返回null
     */
    public Long removeConnection(String connectionId) {
        // 1. 移除物理连接
        connections.remove(connectionId);

        // 2. 通过用户状态管理器处理用户下线（保留状态）
        Long userId = userStateManager.userOffline(connectionId);

        if (userId != null) {
            log.info("连接移除: connectionId={}, userId={}", connectionId, userId);
        }

        return userId;
    }

    /**
     * 获取连接
     *
     * @param connectionId 连接ID
     * @return ConnectionContext，如果不存在则返回null
     */
    public ConnectionContext getConnection(String connectionId) {
        return connections.get(connectionId);
    }

    /**
     * 根据用户ID获取连接
     *
     * @param userId 用户ID
     * @return ConnectionContext，如果用户不在线则返回null
     */
    public ConnectionContext getConnectionByUserId(Long userId) {
        String connectionId = userStateManager.getConnectionIdByUserId(userId);
        return connectionId != null ? connections.get(connectionId) : null;
    }

    /**
     * 根据用户ID获取连接ID
     *
     * @param userId 用户ID
     * @return 连接ID，如果用户不在线则返回null
     */
    public String getConnectionIdByUserId(Long userId) {
        return userStateManager.getConnectionIdByUserId(userId);
    }

    /**
     * 获取玩家对象
     * 通过用户状态管理器获取，无论用户是否在线
     *
     * @param userId 用户ID
     * @return 玩家对象，如果不存在则返回null
     */
    public Player getPlayerByUserId(Long userId) {
        return userStateManager.getUserState(userId);
    }

    /**
     * 根据连接ID获取玩家对象
     *
     * @param connectionId 连接ID
     * @return 玩家对象，如果连接不存在则返回null
     */
    public Player getPlayerByConnectionId(String connectionId) {
        Long userId = userStateManager.getUserIdByConnectionId(connectionId);
        return userId != null ? userStateManager.getUserState(userId) : null;
    }

    // ==================== 消息发送方法 ====================

    /**
     * 发送消息给指定连接
     *
     * @param connectionId 连接ID
     * @param message 消息内容
     * @return 是否发送成功
     */
    public boolean sendMessage(String connectionId, String message) {
        ConnectionContext connectionContext = connections.get(connectionId);
        if (connectionContext != null && connectionContext.isOpen()) {
            return connectionContext.sendMessage(message);
        }
        return false;
    }

    /**
     * 发送消息给指定用户
     *
     * @param userId 用户ID
     * @param message 消息内容
     * @return 是否发送成功
     */
    public boolean sendMessageToUser(Long userId, String message) {
        String connectionId = userStateManager.getConnectionIdByUserId(userId);
        return connectionId != null && sendMessage(connectionId, message);
    }

    /**
     * 广播消息给所有在线玩家
     *
     * @param message 消息内容
     * @return 成功发送的连接数量
     */
    public int broadcastToAll(String message) {
        int successCount = 0;

        for (Map.Entry<String, ConnectionContext> entry : connections.entrySet()) {
            ConnectionContext connectionContext = entry.getValue();
            if (connectionContext != null && connectionContext.isOpen()) {
                if (connectionContext.sendMessage(message)) {
                    successCount++;
                } else {
                    log.error("广播消息失败: connectionId={}", entry.getKey());
                }
            }
        }

        return successCount;
    }

    /**
     * 广播在线用户列表给所有连接的客户端
     */
    public void broadcastAllOnlineUsers() {
        try {
            // 获取所有在线玩家
            List<Player> onlinePlayers = getAllOnlinePlayers();

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

            // 构建业务数据体
            OnlineListResponse data = new OnlineListResponse();
            data.setOnlineCount(onlineUserData.size());
            data.setOnlineUsers(onlineUserData);

            // 使用 WebSocketMsg 构建广播消息
            WebSocketMsg<OnlineListResponse> broadcastMessage = WebSocketMsg.push(
                ModuleType.HALL,
                CmdType.ONLINE_LIST,
                data
            );

            // 序列化消息并广播
            String messageJson = objectMapper.writeValueAsString(broadcastMessage);
            int successCount = broadcastToAll(messageJson);

            log.info("广播在线用户列表完成: 在线人数={}, 成功发送数量={}",
                    onlineUserData.size(), successCount);

        } catch (Exception e) {
            log.error("广播在线用户列表时发生异常: error={}", e.getMessage(), e);
        }
    }

    // ==================== 统计和查询方法 ====================

    /**
     * 获取当前总连接数
     *
     * @return 在线连接数量
     */
    public int getTotalConnections() {
        return connections.size();
    }

    /**
     * 获取在线玩家数量
     * 委托给用户状态管理器
     *
     * @return 在线玩家数量
     */
    public int getOnlinePlayerCount() {
        return userStateManager.getOnlineUserCount();
    }

    /**
     * 检查用户是否在线
     * 委托给用户状态管理器
     *
     * @param userId 用户ID
     * @return 是否在线
     */
    public boolean isUserOnline(Long userId) {
        return userStateManager.isUserOnline(userId);
    }

    /**
     * 获取所有在线玩家
     * 委托给用户状态管理器
     *
     * @return 在线玩家列表
     */
    public List<Player> getAllOnlinePlayers() {
        return userStateManager.getAllOnlineUsers();
    }
    
    // ==================== 辅助方法 ====================

    /**
     * 清理所有连接（应用关闭时调用）
     */
    public void cleanup() {
        log.info("开始清理所有WebSocket连接，当前连接数: {}", connections.size());

        connections.values().forEach(connectionContext -> {
            try {
                if (connectionContext.isOpen()) {
                    connectionContext.close();
                }
            } catch (Exception e) {
                log.error("关闭连接时出错: {}", e.getMessage());
            }
        });

        connections.clear();

        // 清理用户状态管理器
        userStateManager.cleanup();

        log.info("ConnectionManager清理完成");
    }

    /**
     * 获取连接详细信息（用于调试）
     *
     * @param connectionId 连接ID
     * @return 连接详细信息
     */
    public Map<String, Object> getConnectionInfo(String connectionId) {
        Map<String, Object> info = new HashMap<>();

        ConnectionContext connectionContext = connections.get(connectionId);
        Long userId = userStateManager.getUserIdByConnectionId(connectionId);

        if (connectionContext != null) {
            info.put("sessionId", connectionContext.getId());
            info.put("isOpen", connectionContext.isOpen());
        }

        if (userId != null) {
            // 通过用户状态管理器获取详细信息
            Map<String, Object> userInfo = userStateManager.getUserInfo(userId);
            info.putAll(userInfo);
        }

        return info;
    }
}