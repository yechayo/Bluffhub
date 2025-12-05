package com.lb.manager;

import com.lb.entity.Player;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 用户状态管理器
 * 职责：管理玩家的状态信息，独立于连接管理
 * 玩家状态持久化，不因断开连接而丢失
 *
 * @author LiarBar
 * @version 1.0
 */
@Slf4j
@Component
public class UserStateManager {

    // 核心数据结构：用户状态存储
    private final Map<Long, Player> userStates = new ConcurrentHashMap<>(); // userId -> Player对象

    // 用户ID到连接ID的映射（仅在线用户有）
    private final Map<Long, String> userConnections = new ConcurrentHashMap<>(); // userId -> connectionId

    // 连接ID到用户ID的映射（仅在线连接有）
    private final Map<String, Long> connectionToUser = new ConcurrentHashMap<>(); // connectionId -> userId

    // ==================== 用户状态管理方法 ====================

    /**
     * 添加或更新用户状态
     *
     * @param userId 用户ID
     * @param player Player对象
     */
    public void addOrUpdateUserState(Long userId, Player player) {
        userStates.put(userId, player);
        log.debug("用户状态已更新: userId={}, status={}", userId, player.getStatusDescription());
    }

    /**
     * 获取用户状态
     *
     * @param userId 用户ID
     * @return Player对象，如果不存在则返回null
     */
    public Player getUserState(Long userId) {
        return userStates.get(userId);
    }

    /**
     * 移除用户状态（用户完全离开游戏时调用）
     *
     * @param userId 用户ID
     * @return 被移除的Player对象
     */
    public Player removeUserState(Long userId) {
        // 清理连接映射
        userConnections.remove(userId);

        Player player = userStates.remove(userId);
        if (player != null) {
            log.info("用户状态已移除: userId={}", userId);
        }

        return player;
    }

    /**
     * 用户上线
     *
     * @param userId 用户ID
     * @param connectionId 连接ID
     */
    public void userOnline(Long userId, String connectionId) {
        userConnections.put(userId, connectionId);
        connectionToUser.put(connectionId, userId);

        Player player = userStates.get(userId);
        if (player != null) {
            player.setOnline();
            log.info("用户上线: userId={}, connectionId={}", userId, connectionId);
        }
    }

    /**
     * 用户下线（断开连接，但保留状态）
     *
     * @param connectionId 连接ID
     * @return 用户ID，如果连接不存在则返回null
     */
    public Long userOffline(String connectionId) {
        Long userId = connectionToUser.remove(connectionId);
        if (userId != null) {
            userConnections.remove(userId);

            Player player = userStates.get(userId);
            if (player != null) {
                // 设置为断线状态，但不清理其他状态信息
                player.setOffline();
                log.info("用户下线: userId={}, connectionId={}", userId, connectionId);
            }
        }
        return userId;
    }

    /**
     * 检查用户是否在线
     *
     * @param userId 用户ID
     * @return 是否在线
     */
    public boolean isUserOnline(Long userId) {
        return userConnections.containsKey(userId);
    }

    /**
     * 根据连接ID获取用户ID
     *
     * @param connectionId 连接ID
     * @return 用户ID，如果连接不存在则返回null
     */
    public Long getUserIdByConnectionId(String connectionId) {
        return connectionToUser.get(connectionId);
    }

    /**
     * 根据用户ID获取连接ID
     *
     * @param userId 用户ID
     * @return 连接ID，如果用户不在线则返回null
     */
    public String getConnectionIdByUserId(Long userId) {
        return userConnections.get(userId);
    }

    // ==================== 统计和查询方法 ====================

    /**
     * 获取在线用户数量
     *
     * @return 在线用户数量
     */
    public int getOnlineUserCount() {
        return userConnections.size();
    }

    /**
     * 获取总用户数量（包括在线和离线）
     *
     * @return 总用户数量
     */
    public int getTotalUserCount() {
        return userStates.size();
    }

    /**
     * 获取所有在线用户
     *
     * @return 在线用户列表
     */
    public List<Player> getAllOnlineUsers() {
        return userConnections.keySet().stream()
                .map(userStates::get)
                .filter(player -> player != null && player.isOnline())
                .collect(Collectors.toList());
    }

    /**
     * 获取所有用户（包括在线和离线）
     *
     * @return 所有用户列表
     */
    public List<Player> getAllUsers() {
        return userStates.values().stream()
                .collect(Collectors.toList());
    }

    /**
     * 按状态统计用户数量
     *
     * @return 状态统计信息
     */
    public Map<String, Long> getUserStatsByStatus() {
        return userStates.values().stream()
                .collect(Collectors.groupingBy(
                    player -> player.getStatusDescription(),
                    Collectors.counting()
                ));
    }

    /**
     * 获取用户状态统计信息
     *
     * @return 统计信息
     */
    public Map<String, Object> getUserStateStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", getTotalUserCount());
        stats.put("onlineUsers", getOnlineUserCount());
        stats.put("offlineUsers", getTotalUserCount() - getOnlineUserCount());
        stats.put("statusDistribution", getUserStatsByStatus());
        stats.put("timestamp", LocalDateTime.now());

        return stats;
    }

    // ==================== 批量操作方法 ====================



    /**
     * 清理所有用户状态（应用关闭时调用）
     */
    public void cleanup() {
        log.info("开始清理所有用户状态，当前用户数: {}", userStates.size());

        userStates.clear();
        userConnections.clear();
        connectionToUser.clear();

        log.info("UserStateManager清理完成");
    }

    // ==================== 调试方法 ====================

    /**
     * 获取用户详细信息（用于调试）
     *
     * @param userId 用户ID
     * @return 用户详细信息
     */
    public Map<String, Object> getUserInfo(Long userId) {
        Map<String, Object> info = new HashMap<>();

        Player player = userStates.get(userId);
        if (player != null) {
            info.put("userId", player.getUserId());
            info.put("username", player.getUsername());
            info.put("status", player.getStatusDescription());
            info.put("location", player.getLocationDescription());
            info.put("isOnline", player.isOnline());
            info.put("roomId", player.getRoomId());
            info.put("sessionId", player.getSessionId());
        }

        String connectionId = userConnections.get(userId);
        info.put("connectionId", connectionId);
        info.put("hasConnection", connectionId != null);

        return info;
    }
}