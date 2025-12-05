package com.lb.message.vo.game;

import lombok.Data;

import java.util.List;

/**
 * 玩家座位信息VO
 * 用于向所有玩家广播座位顺序
 */
@Data
public class PlayerSeatsVO {

    private Long gameId;                   // 游戏ID

    private List<Long> playerIds;          // 玩家座位顺序（按座位索引排序）
}