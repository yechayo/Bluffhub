package com.lb.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.lb.util.SpringContextHolder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 统一玩家实体类
 * 职责：管理玩家在大厅、房间、游戏中的所有状态
 * 状态流转：ONLINE -> IN_ROOM -> PLAYING -> FINISHED -> ONLINE
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("player")
public class Player {

    /**
     * 关联的用户ID - 外键
     */
    @TableField("user_id")
    private Long userId;

    /**
     * 用户名 - 冗余存储，避免频繁查询数据库
     */
    @TableField("username")
    private String username;

    private String NickName;

    /**
     * 游戏会话ID - 可选，当玩家在游戏中时设置
     */
    @TableField("session_id")
    private Long sessionId;

    /**
     * 玩家在线状态 - 核心状态字段
     */
    @TableField("online_status")
    private OnlineStatus onlineStatus;

    /**
     * 玩家位置类型 - 标识玩家当前所处的位置
     */
    @TableField("location_type")
    private LocationType locationType;

    /**
     * 座位号 - 1-4号座位，-1表示未分配
     */
    @TableField("seat_number")
    private Integer seatNumber;

    /**
     * 是否为房主
     */
    @TableField("is_owner")
    private Boolean isOwner;

    /**
     * 是否准备就绪（房间中状态）
     */
    @TableField("is_ready")
    private Boolean isReady;

    /**
     * 是否存活（游戏进行中状态）
     */
    @TableField("is_alive")
    private Boolean isAlive;

    /**
     * 当前得分
     */
    @TableField("score")
    private Integer score;

    /**
     * 胜利次数
     */
    @TableField("win_count")
    private Integer winCount;

    /**
     * 失败次数
     */
    @TableField("lose_count")
    private Integer loseCount;

    /**
     * 手牌数据 - JSON格式存储玩家的手牌信息
     */
    @TableField("hand_cards")
    private String handCards;

    /**
     * 游戏动作记录 - JSON格式存储玩家的操作历史
     */
    @TableField("action_history")
    private String actionHistory;

    /**
     * 扩展数据 - JSON格式存储玩家在房间内的额外信息
     */
    @TableField("player_data")
    private String playerData;

    
    /**
     * 加入房间时间
     */
    @TableField("join_time")
    private LocalDateTime joinTime;

    /**
     * 最后行动时间（游戏中）
     */
    @TableField("last_action_time")
    private LocalDateTime lastActionTime;

    /**
     * 临时标记 - 游戏过程中的临时状态
     */
    @TableField("temp_flag")
    private Integer tempFlag;

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
     * 在线状态枚举
     */
    public enum OnlineStatus {
        ONLINE(1, "在线"),         // 正常在线
        OFFLINE(2, "断线");        // 网络断开

        private final Integer code;
        private final String description;

        OnlineStatus(Integer code, String description) {
            this.code = code;
            this.description = description;
        }

        public Integer getCode() {
            return code;
        }

        public String getDescription() {
            return description;
        }

        public static OnlineStatus fromCode(Integer code) {
            for (OnlineStatus status : values()) {
                if (status.code.equals(code)) {
                    return status;
                }
            }
            throw new IllegalArgumentException("Unknown online status code: " + code);
        }
    }

    /**
     * 位置类型枚举 - 标识玩家当前所处的位置
     */
    @Getter
    public enum LocationType {
        LOBBY(1, "大厅"),              // 在游戏大厅
        ROOM(2, "房间"),               // 在游戏房间
        GAME(3, "游戏中");             // 在游戏进行中

        private final Integer code;
        private final String description;

        LocationType(Integer code, String description) {
            this.code = code;
            this.description = description;
        }

        public static LocationType fromCode(Integer code) {
            for (LocationType type : values()) {
                if (type.code.equals(code)) {
                    return type;
                }
            }
            throw new IllegalArgumentException("Unknown location type code: " + code);
        }
    }

    // ==================== 状态检查方法 ====================

    /**
     * 检查玩家是否在线
     */
    public boolean isOnline() {
        return onlineStatus == OnlineStatus.ONLINE;
    }

    /**
     * 检查玩家是否在大厅中
     */
    public boolean isInLobby() {
        return locationType == LocationType.LOBBY;
    }

    /**
     * 检查玩家是否在房间中
     */
    public boolean isInRoom() {
        if (locationType != LocationType.ROOM) {
            return false;
        }

        // 通过RoomManager查询玩家是否在房间中
        try {
            return SpringContextHolder.getRoomManager().isPlayerInRoom(userId);
        } catch (Exception e) {
            // 如果SpringContextHolder未初始化，返回false
            return false;
        }
    }

    /**
     * 检查玩家是否在游戏中
     */
    public boolean isInGame() {
        return locationType == LocationType.GAME && sessionId != null;
    }

    /**
     * 检查玩家是否已准备
     */
    public boolean isPrepared() {
        return Boolean.TRUE.equals(isReady) && isInRoom();
    }

    /**
     * 检查玩家是否为房主
     */
    public boolean isRoomOwner() {
        return Boolean.TRUE.equals(isOwner);
    }




    
    // ==================== 状态变更方法 ====================

    /**
     * 玩家进入大厅
     */
    public void enterLobby() {
        this.locationType = LocationType.LOBBY;
        this.onlineStatus = OnlineStatus.ONLINE;
        this.sessionId = null;
        this.isReady = false;
        this.isOwner = false;
        this.seatNumber = -1;
    }

    /**
     * 玩家加入房间
     */
    public void joinRoom(Long roomId) {
        this.locationType = LocationType.ROOM;
        this.isReady = false;
        this.joinTime = LocalDateTime.now();
    }

    /**
     * 玩家离开房间
     */
    public void leaveRoom() {
        this.locationType = LocationType.LOBBY;
        this.sessionId = null;
        this.isReady = false;
        this.isOwner = false;
        this.seatNumber = -1;
    }

    /**
     * 玩家准备
     */
    public void ready() {
        if (isInRoom()) {
            this.isReady = true;
        }
    }

    /**
     * 玩家取消准备
     */
    public void unready() {
        if (isInRoom()) {
            this.isReady = false;
        }
    }

    /**
     * 设置为离线状态
     */
    public void setOffline() {
        this.onlineStatus = OnlineStatus.OFFLINE;
    }

    /**
     * 设置为在线状态
     */
    public void setOnline() {
        this.onlineStatus = OnlineStatus.ONLINE;
    }

    


    /**
     * 设置为房主
     */
    public void setAsOwner(boolean isOwner) {
        this.isOwner = isOwner;
    }

    /**
     * 增加得分
     */
    public void addScore(int points) {
        this.score = (this.score == null ? 0 : this.score) + points;
    }

    /**
     * 获取胜率
     */
    public double getWinRate() {
        int totalGames = (winCount == null ? 0 : winCount) + (loseCount == null ? 0 : loseCount);
        if (totalGames == 0) {
            return 0.0;
        }
        return (double) (winCount == null ? 0 : winCount) / totalGames;
    }

    
    /**
     * 获取玩家当前位置描述
     */
    public String getLocationDescription() {
        if (locationType == null) {
            return "未知";
        }
        return locationType.getDescription();
    }

    /**
     * 获取玩家状态描述
     */
    public String getStatusDescription() {
        if (onlineStatus == null) {
            return "未知";
        }
        return onlineStatus.getDescription();
    }

    /**
     * 玩家离开游戏
     */
    public void leaveGame() {
        // 设置玩家为死亡状态
        this.isAlive = false;
        // 更新玩家位置为大厅
        this.locationType = LocationType.ROOM;
        this.sessionId = null;
        this.isReady = false;
        this.isOwner = false;
        this.seatNumber = -1;
        // 重置游戏相关字段
        this.handCards = null;
        this.actionHistory = null;
    }

    /**
     * 获取玩家所在的房间ID
     * 通过RoomManager查询，确保数据一致性
     *
     * @return 房间ID，如果玩家不在房间中则返回null
     */
    public Long getRoomId() {
        try {
            return SpringContextHolder.getRoomManager().getPlayerRoomId(userId);
        } catch (Exception e) {
            // 如果SpringContextHolder未初始化，返回null
            return null;
        }
    }

    public Long getGameId() {
        try {
            return SpringContextHolder.getGameManager().getPlayerGameId(userId);
        } catch (Exception e) {
            // 如果SpringContextHolder未初始化，返回null
            return null;
        }
    }

}