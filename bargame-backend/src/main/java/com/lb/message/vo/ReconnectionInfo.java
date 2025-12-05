package com.lb.message.vo;

import com.lb.entity.game.CardType;
import com.lb.entity.game.GamePlayer;
import com.lb.message.vo.game.PlayerVO;
import com.lb.message.vo.hall.OnlineListResponse;
import lombok.Data;

import java.util.List;

@Data
public class ReconnectionInfo {

    //大厅重连信息

    private OnlineListResponse onlineListResponse;
    //房间重连信息
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

    //游戏重连信息
    private Long gameId;                   // 游戏 ID

    private GamePlayer gamePlayers;       //每个玩家只返回自己的对象

    private Long firstPlayerId;            // 第一个出牌的人，前端需要高亮

    private CardType targetCardType;       // 本轮目标牌（Q/K/A）

    private int roundNumber;               // 当前轮次

    private List<Long> playerIds;         //座位顺序

    private List<Long> handCards;       //其他玩家手牌数量

    private List<Long> bulletCounts;    //其他玩家子弹数量


}
