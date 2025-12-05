package com.lb.message.vo.game;

import lombok.Data;

@Data
public class LeaveGameVO {
    private Long gameId;                  // 当前游戏ID
    private int roundNumber;
    private Long leavePlayerId;
}

