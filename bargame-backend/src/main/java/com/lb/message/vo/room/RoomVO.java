package com.lb.message.vo.room;

import com.lb.message.vo.game.PlayerVO;
import lombok.Data;

import java.util.List;

@Data
public class RoomVO {

    /** 房间ID */
    private Long roomId;

    /** 房间名称 */
    private String roomName;

    /** 房主ID */
    private Long ownerId;

    /** 房间状态描述（等待中/游戏中/已结束） */
    private String roomStatus;

    /** 游戏模式名称 */
    private String gameModeName;

    /** 当前玩家数量 */
    private Integer currentPlayerCount;

    /** 最大玩家数量 */
    private Integer maxPlayers;

    /** 空余位置数量 */
    private Integer availableSlots;

    /** 房间是否为私密房间 */
    private Boolean isPrivate;

    /** 房间描述 */
    private String description;

    /** 房间内玩家信息列表 */
    private List<PlayerVO> players;

    /** 房间创建时间（可选） */
    private String createdAt;

    /** 背景音乐配置 */
    private String backgroundMusic;

    /** 额外扩展字段（可选） */
    private String extConfig;
}
