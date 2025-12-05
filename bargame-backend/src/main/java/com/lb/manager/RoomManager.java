package com.lb.manager;

import com.lb.entity.Player;
import com.lb.entity.Room;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 房间管理器
 * 职责：管理游戏房间的创建、加入、离开、解散等核心功能
 * 与ConnectionManager协作：ConnectionManager管理连接，RoomManager管理房间业务逻辑
 * 与UserStateManager协作：用户状态管理器提供Player对象
 *
 * @author LiarBar
 * @version 2.0
 */
@Slf4j
@Component
public class RoomManager {

    // ==================== 核心数据结构 ====================

    // 房间存储：roomId -> Room
    private final Map<Long, Room> roomMap = new ConcurrentHashMap<>();

    // 玩家位置追踪：playerId -> roomId
    private final Map<Long, Long> playerRoomMap = new ConcurrentHashMap<>();

    // 房间ID生成器
    private long roomIdSequence = 1000; // 起始房间ID

    // 依赖注入
    @Autowired
    private UserStateManager userStateManager;

    // ==================== 房间创建相关 ====================

    /**
     * 创建新房间
     *
     * @param ownerId 房主ID
     * @param roomName 房间名称
     * @param gameMode 游戏模式
     * @param maxPlayers 最大玩家数量
     * @return 创建的房间信息
     */
    public Room createRoom(Long ownerId, String roomName, Room.GameMode gameMode, Integer maxPlayers) {
        try {
            // 1. 检查房主是否已在其他房间
            if (isPlayerInRoom(ownerId)) {
                log.warn("创建房间失败：玩家已在其他房间中，playerId={}", ownerId);
                throw new IllegalStateException("玩家已在其他房间中，无法创建新房间");
            }

            // 2. 获取房主Player对象
            Player owner = userStateManager.getUserState(ownerId);
            if (owner == null) {
                log.warn("创建房间失败：房主不存在，ownerId={}", ownerId);
                throw new IllegalArgumentException("房主不存在");
            }

            // 3. 生成房间ID
            Long roomId = generateRoomId();

            // 4. 创建房间对象
            Room room = new Room();
            room.setRoomId(roomId);
            room.setRoomName(roomName);
            room.setOwnerId(ownerId);
            room.setGameMode(gameMode);
            room.setRoomStatus(Room.RoomStatus.WAITING);
            room.setMaxPlayers(maxPlayers != null ? maxPlayers : gameMode.getDefaultMaxPlayers());
            room.setIsPrivate(false);
            room.setCreatedAt(LocalDateTime.now());
            room.setUpdatedAt(LocalDateTime.now());

            // 5. 房主加入房间
            room.addPlayer(owner);
            playerRoomMap.put(ownerId, roomId);

            // 更新房主状态
            owner.joinRoom(roomId);

            // 6. 更新内存数据结构
            roomMap.put(roomId, room);

            log.info("创建房间成功：roomId={}, roomName={}, owner={}",
                    roomId, roomName, owner.getUsername());

            return room;

        } catch (Exception e) {
            log.error("创建房间失败：ownerId={}, roomName={}, error={}",
                    ownerId, roomName, e.getMessage(), e);
            throw new RuntimeException("创建房间失败: " + e.getMessage(), e);
        }
    }

    /**
     * 解散房间
     *
     * @param roomId 房间ID
     * @param requesterId 请求者ID（用于权限验证）
     */
    public void dismissRoom(Long roomId, Long requesterId) {
        try {
            Room room = roomMap.get(roomId);
            if (room == null) {
                log.warn("解散房间失败：房间不存在，roomId={}", roomId);
                throw new IllegalArgumentException("房间不存在");
            }

            // 检查权限（只有房主可以解散房间）
            if (!room.isOwner(requesterId)) {
                log.warn("解散房间失败：无权限，roomId={}, requesterId={}, ownerId={}",
                        roomId, requesterId, room.getOwnerId());
                throw new IllegalStateException("只有房主可以解散房间");
            }

            // 清理所有成员
            Map<Long, Player> players = room.getAllPlayers();
            for (Map.Entry<Long, Player> entry : players.entrySet()) {
                Long playerId = entry.getKey();
                Player player = entry.getValue();

                // 移除玩家房间映射
                playerRoomMap.remove(playerId);

                // 更新玩家状态
                player.leaveRoom();
            }

            // 清理房间信息
            roomMap.remove(roomId);

            log.info("解散房间成功：roomId={}, requesterId={}", roomId, requesterId);

        } catch (Exception e) {
            log.error("解散房间失败：roomId={}, requesterId={}, error={}", roomId, requesterId, e.getMessage(), e);
            throw new RuntimeException("解散房间失败: " + e.getMessage(), e);
        }
    }

    // ==================== 房间加入相关 ====================

    /**
     * 玩家加入房间
     *
     * @param playerId 玩家ID
     * @param roomId 房间ID
     * @return 加入后的房间信息
     */
    public Room joinRoom(Long playerId, Long roomId) {
        try {
            // 1. 检查玩家是否已在其他房间
            if (isPlayerInRoom(playerId)) {
                log.warn("加入房间失败：玩家已在其他房间，playerId={}", playerId);
                throw new IllegalStateException("玩家已在其他房间中");
            }

            // 2. 获取房间信息
            Room room = roomMap.get(roomId);
            if (room == null) {
                log.warn("加入房间失败：房间不存在，roomId={}", roomId);
                throw new IllegalArgumentException("房间不存在");
            }

            // 3. 获取玩家对象
            Player player = userStateManager.getUserState(playerId);
            if (player == null) {
                log.warn("加入房间失败：玩家不存在，playerId={}", playerId);
                throw new IllegalArgumentException("玩家不存在");
            }

            // 4. 检查房间是否可以加入
            if (!room.canJoin()) {
                log.warn("加入房间失败：房间状态不允许加入，roomId={}, status={}, current={}, max={}",
                        roomId, room.getRoomStatus(), room.getCurrentPlayerCount(), room.getMaxPlayers());
                throw new IllegalStateException("房间当前状态不允许加入");
            }

            // 5. 加入房间
            if (!room.addPlayer(player)) {
                throw new IllegalStateException("加入房间失败");
            }

            playerRoomMap.put(playerId, roomId);

            // 更新玩家状态
            player.joinRoom(roomId);

            // 更新房间状态
            room.setUpdatedAt(LocalDateTime.now());

            log.info("加入房间成功：playerId={}, roomId={}, currentPlayers={}",
                    playerId, roomId, room.getCurrentPlayerCount());

            return room;

        } catch (Exception e) {
            log.error("加入房间失败：playerId={}, roomId={}, error={}",
                    playerId, roomId, e.getMessage(), e);
            throw new RuntimeException("加入房间失败: " + e.getMessage(), e);
        }
    }

    /**
     * 玩家离开房间
     *
     * @param playerId 玩家ID
     * @return 玩家离开的房间信息，如果玩家不在任何房间则返回null
     */
    public Room leaveRoom(Long playerId) {
        try {
            Long roomId = playerRoomMap.get(playerId);
            if (roomId == null) {
                log.debug("离开房间：玩家不在任何房间中，playerId={}", playerId);
                return null;
            }

            Room room = roomMap.get(roomId);
            if (room == null) {
                log.warn("离开房间：房间不存在，roomId={}, playerId={}", roomId, playerId);
                playerRoomMap.remove(playerId);
                return null;
            }

            room.removePlayer(playerId);

            // 清理玩家位置信息
            playerRoomMap.remove(playerId);

            // 如果房间为空，自动解散
            if (room.getAllPlayers().isEmpty()) {
                log.info("房间无成员，自动解散：roomId={}", roomId);
                roomMap.remove(roomId);
                return room;
            }

            // 如果离开的是房主，转让给下一个玩家
            if (room.isOwner(playerId)) {
                transferOwnership(roomId);
            }

            // 更新房间状态
            room.setUpdatedAt(LocalDateTime.now());

            log.info("离开房间成功：playerId={}, roomId={}, currentPlayers={}",
                    playerId, roomId, room.getCurrentPlayerCount());

            return room;

        } catch (Exception e) {
            log.error("离开房间失败：playerId={}, error={}", playerId, e.getMessage(), e);
            throw new RuntimeException("离开房间失败: " + e.getMessage(), e);
        }
    }

    // ==================== 查询相关 ====================

    /**
     * 获取房间信息
     *
     * @param roomId 房间ID
     * @return 房间信息，如果不存在则返回null
     */
    public Room getRoomInfo(Long roomId) {
        return roomMap.get(roomId);
    }

    /**
     * 检查指定用户是否为房主
     *
     * @param roomId 房间ID
     * @param userId 用户ID
     * @return true如果是房主，false如果不是房主或房间不存在
     */
    public boolean isOwner(Long roomId, Long userId) {
        Room room = roomMap.get(roomId);
        return room != null && room.isOwner(userId);
    }

    /**
     * 获取玩家所在的房间
     *
     * @param playerId 玩家ID
     * @return 房间信息，如果玩家不在房间中则返回null
     */
    public Room getPlayerRoom(Long playerId) {
        Long roomId = playerRoomMap.get(playerId);
        return roomId != null ? roomMap.get(roomId) : null;
    }

    /**
     * 获取房间内所有玩家
     *
     * @param roomId 房间ID
     * @return 玩家集合
     */
    public Collection<Player> getRoomPlayers(Long roomId) {
        Room room = roomMap.get(roomId);
        return room != null ? room.getAllPlayers().values() : Collections.emptyList();
    }

    /**
     * 获取所有活跃房间列表
     *
     * @return 房间列表
     */
    public List<Room> getActiveRoomList() {
        return new ArrayList<>(roomMap.values());
    }

    /**
     * 获取可加入的房间列表（等待中且未满）
     *
     * @return 可加入的房间列表
     */
    public List<Room> getAvailableRoomList() {
        return roomMap.values().stream()
                .filter(Room::canJoin)
                .collect(Collectors.toList());
    }

    /**
     * 检查玩家是否在房间中
     *
     * @param playerId 玩家ID
     * @return true表示在房间中，false表示不在
     */
    public boolean isPlayerInRoom(Long playerId) {
        return playerRoomMap.containsKey(playerId);
    }

    /**
     * 获取玩家所在的房间ID
     *
     * @param playerId 玩家ID
     * @return 房间ID，如果不在房间中则返回null
     */
    public Long getPlayerRoomId(Long playerId) {
        return playerRoomMap.get(playerId);
    }

    /**
     * 获取房间数量统计
     *
     * @return 包含总房间数、活跃房间数、在线玩家数的统计信息
     */
    public Map<String, Object> getRoomStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRooms", roomMap.size());
        stats.put("waitingRooms", roomMap.values().stream()
                .filter(room -> room.getRoomStatus() == Room.RoomStatus.WAITING)
                .count());
        stats.put("playingRooms", roomMap.values().stream()
                .filter(room -> room.getRoomStatus() == Room.RoomStatus.PLAYING)
                .count());
        stats.put("totalPlayersInRooms", playerRoomMap.size());
        return stats;
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 生成唯一的房间ID
     */
    private Long generateRoomId() {
        return ++roomIdSequence;
    }

    /**
     * 转移房主身份
     *
     * @param roomId 房间ID
     */
    private void transferOwnership(Long roomId) {
        Room room = roomMap.get(roomId);
        if (room == null) {
            return;
        }

        Collection<Player> players = room.getAllPlayers().values();
        if (players.isEmpty()) {
            return;
        }

        // 找到第一个在线玩家作为新房主
        Player newOwner = players.stream()
                .filter(Player::isOnline)
                .findFirst()
                .orElse(players.iterator().next());

        if (newOwner != null) {
            room.transferOwnership(newOwner.getUserId());
            log.info("房主转移：roomId={}, oldOwner={}, newOwner={}",
                    roomId, room.getOwnerId(), newOwner.getUserId());
        }
    }

    /**
     * 清理所有房间（应用关闭时调用）
     */
    public void cleanup() {
        log.info("开始清理所有房间，当前房间数: {}", roomMap.size());

        // 清理所有玩家的房间状态
        for (Map.Entry<Long, Long> entry : playerRoomMap.entrySet()) {
            Long playerId = entry.getKey();
            Player player = userStateManager.getUserState(playerId);
            if (player != null) {
                player.leaveRoom();
            }
        }

        roomMap.clear();
        playerRoomMap.clear();

        log.info("RoomManager清理完成");
    }
}