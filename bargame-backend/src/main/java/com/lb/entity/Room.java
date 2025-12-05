package com.lb.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.lb.message.vo.room.RoomVO;
import com.lb.message.vo.game.PlayerVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 房间实体类
 * 职责单一：只负责房间基础信息和玩家成员的管理
 * 状态明确：通过枚举明确定义房间状态
 * 可扩展：预留了扩展字段和灵活配置
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("room")
public class Room {

    /**
     * 房间ID - 主键，唯一标识
     */
    @TableId(value = "id", type = IdType.AUTO)
    private Long roomId;

    /**
     * 房间名称 - 房主自定义
     */
    @TableField("room_name")
    private String roomName;

    /**
     * 房主ID - 外键关联用户表
     */
    @TableField("owner_id")
    private Long ownerId;

    /**
     * 房间状态 - 使用枚举管理
     */
    @TableField("room_status")
    private RoomStatus roomStatus;

    /**
     * 游戏模式 - 使用枚举管理
     */
    @TableField("game_mode")
    private GameMode gameMode;

    /**
     * 背景音乐配置
     */
    @TableField("background_music")
    private String backgroundMusic;

    /**
     * 最大玩家数量 - 默认4人
     */
    @TableField("max_players")
    private Integer maxPlayers = 4;

    /**
     * 房间密码 - 可选，私密房间
     */
    @TableField("room_password")
    private String roomPassword;

    /**
     * 房间描述 - 可选
     */
    @TableField("description")
    private String description;

    /**
     * 是否为私密房间
     */
    @TableField("is_private")
    private Boolean isPrivate;

    /**
     * 扩展配置 - JSON格式存储额外配置
     */
    @TableField("ext_config")
    private String extConfig;

    /**
     * 房间成员管理 - 玩家ID到Player对象的映射
     * 注意：这个字段不持久化到数据库，只在内存中管理
     */
    @TableField(exist = false)
    private Map<Long, Player> players = new ConcurrentHashMap<>();

    /**
     * 创建时间
     */
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    /**
     * 房间状态枚举
     */
    public enum RoomStatus {
        WAITING(1, "等待中"),           // 等待玩家加入
        PREPARING(2, "准备中"),         // 房主点击开始，游戏加载中
        PLAYING(3, "游戏中"),           // 游戏进行中
        PAUSED(4, "暂停中"),           // 游戏暂停（预留）
        FINISHED(5, "已结束"),         // 游戏结束
        DISMISSED(6, "已解散");        // 房间解散

        private final Integer code;
        private final String description;

        RoomStatus(Integer code, String description) {
            this.code = code;
            this.description = description;
        }

        public Integer getCode() {
            return code;
        }

        public String getDescription() {
            return description;
        }

        public static RoomStatus fromCode(Integer code) {
            for (RoomStatus status : values()) {
                if (status.code.equals(code)) {
                    return status;
                }
            }
            throw new IllegalArgumentException("Unknown room status code: " + code);
        }
    }

    /**
     * 游戏模式枚举
     */
    public enum GameMode {
        CLASSIC(1, "经典模式", 4, 60),        // 经典骗子酒馆模式，4人，60秒/回合
        QUICK(2, "快速模式", 3, 30),          // 快速模式，3人，30秒/回合
        CUSTOM(3, "自定义模式", 4, 0);        // 自定义模式，时间可配置

        private final Integer code;
        private final String name;
        private final Integer defaultMaxPlayers;
        private final Integer defaultTurnSeconds;

        GameMode(Integer code, String name, Integer defaultMaxPlayers, Integer defaultTurnSeconds) {
            this.code = code;
            this.name = name;
            this.defaultMaxPlayers = defaultMaxPlayers;
            this.defaultTurnSeconds = defaultTurnSeconds;
        }

        public Integer getCode() {
            return code;
        }

        public String getName() {
            return name;
        }

        public Integer getDefaultMaxPlayers() {
            return defaultMaxPlayers;
        }

        public Integer getDefaultTurnSeconds() {
            return defaultTurnSeconds;
        }

        public static GameMode fromCode(Integer code) {
            for (GameMode mode : values()) {
                if (mode.code.equals(code)) {
                    return mode;
                }
            }
            throw new IllegalArgumentException("Unknown game mode code: " + code);
        }
    }

    // ==================== 业务逻辑方法 ====================

    /**
     * 检查房间是否可以加入
     */
    public boolean canJoin() {
        return roomStatus == RoomStatus.WAITING
               && players.size() < maxPlayers;
    }

    /**
     * 检查房间是否为私密房间
     */
    public boolean isPrivateRoom() {
        return Boolean.TRUE.equals(isPrivate);
    }

    /**
     * 检查指定用户是否为房主
     */
    public boolean isOwner(Long userId) {
        return ownerId != null && ownerId.equals(userId);
    }

    /**
     * 检查是否可以开始游戏（至少2人）
     */
    public boolean canStartGame() {
        return roomStatus == RoomStatus.WAITING
               && players.size() >= 2
               && players.size() <= maxPlayers;
    }

    /**
     * 检查房间是否已满
     */
    public boolean isFull() {
        return players.size() >= maxPlayers;
    }

    /**
     * 获取空余位置数量
     */
    public Integer getAvailableSlots() {
        return Math.max(0, maxPlayers - players.size());
    }

    /**
     * 获取当前玩家数量
     */
    public int getCurrentPlayerCount() {
        return players.size();
    }

    // ==================== 玩家管理方法 ====================

    /**
     * 添加玩家到房间
     *
     * @param player 玩家对象
     * @return 是否添加成功
     */
    public boolean addPlayer(Player player) {
        if (player == null || isFull() || players.containsKey(player.getUserId())) {
            return false;
        }

        players.put(player.getUserId(), player);
        return true;
    }

    /**
     * 从房间移除玩家
     *
     * @param playerId 玩家ID
     * @return 被移除的玩家对象，如果不存在则返回null
     */
    public Player removePlayer(Long playerId) {
        return players.remove(playerId);
    }

    /**
     * 检查玩家是否在房间中
     *
     * @param playerId 玩家ID
     * @return 是否在房间中
     */
    public boolean hasPlayer(Long playerId) {
        return players.containsKey(playerId);
    }

    /**
     * 获取指定玩家
     *
     * @param playerId 玩家ID
     * @return 玩家对象，如果不存在则返回null
     */
    public Player getPlayer(Long playerId) {
        return players.get(playerId);
    }

    /**
     * 获取房间内所有玩家
     *
     * @return 玩家集合
     */
    public Map<Long, Player> getAllPlayers() {
        return new ConcurrentHashMap<>(players);
    }

    /**
     * 获取房间内在线玩家数量
     *
     * @return 在线玩家数量
     */
    public int getOnlinePlayerCount() {
        return (int) players.values().stream()
                .filter(Player::isOnline)
                .count();
    }

    /**
     * 检查所有玩家是否都已准备
     *
     * @return 是否都已准备
     */
    public boolean areAllPlayersReady() {
        return players.values().stream()
                .allMatch(Player::isPrepared);
    }

    /**
     * 获取房主对象
     *
     * @return 房主对象，如果不存在则返回null
     */
    public Player getOwner() {
        return ownerId != null ? players.get(ownerId) : null;
    }

    /**
     * 转移房主身份给指定玩家
     *
     * @param newOwnerId 新房主ID
     * @return 是否转移成功
     */
    public boolean transferOwnership(Long newOwnerId) {
        if (newOwnerId == null || !players.containsKey(newOwnerId)) {
            return false;
        }

        this.ownerId = newOwnerId;
        return true;
    }

    /**
     * 清空所有玩家
     */
    public void clearAllPlayers() {
        players.clear();
    }

    // ==================== 转换方法 ====================

    /**
     * 将Room对象转换为RoomVO对象
     *
     * @return RoomVO对象
     */
    public RoomVO toRoomVO() {
        RoomVO roomVO = new RoomVO();

        // 基础信息映射
        roomVO.setRoomId(this.roomId);
        roomVO.setRoomName(this.roomName);
        roomVO.setOwnerId(this.ownerId);
        roomVO.setRoomStatus(this.roomStatus != null ? this.roomStatus.getDescription() : null);
        roomVO.setGameModeName(this.gameMode != null ? this.gameMode.getName() : null);
        roomVO.setMaxPlayers(this.maxPlayers);
        roomVO.setCurrentPlayerCount(this.getCurrentPlayerCount());
        roomVO.setAvailableSlots(this.getAvailableSlots());
        roomVO.setIsPrivate(this.isPrivate);
        roomVO.setDescription(this.description);
        roomVO.setBackgroundMusic(this.backgroundMusic);
        roomVO.setExtConfig(this.extConfig);

        // 格式化创建时间
        if (this.createdAt != null) {
            roomVO.setCreatedAt(this.createdAt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        }

        // 转换玩家信息
        List<PlayerVO> playerVOList = this.players.values().stream()
                .map(this::convertToPlayerVO)
                .collect(Collectors.toList());
        roomVO.setPlayers(playerVOList);

        return roomVO;
    }

    /**
     * 将Player对象转换为PlayerVO对象
     *
     * @param player Player对象
     * @return PlayerVO对象
     */
    private PlayerVO convertToPlayerVO(Player player) {
        if (player == null) {
            return null;
        }

        PlayerVO playerVO = new PlayerVO();
        playerVO.setPlayerId(player.getUserId());
        playerVO.setNickname(player.getNickName() != null ? player.getNickName() : player.getUsername());
        // Player类中没有avatar字段，暂时设置为null，可以后续扩展
        playerVO.setAvatar(null);
        playerVO.setIsPrepared(player.isPrepared());
        playerVO.setIsOwner(isOwner(player.getUserId()));

        return playerVO;
    }

    /**
     * 静态工厂方法：从Room对象创建RoomVO对象
     *
     * @param room Room对象
     * @return RoomVO对象，如果room为null则返回null
     */
    public static RoomVO fromRoom(Room room) {
        return room != null ? room.toRoomVO() : null;
    }
}