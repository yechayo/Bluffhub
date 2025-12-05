package com.lb.message.vo.game;

import lombok.Data;

@Data
public class GameOverVO {
    private Long gameId;                  // 游戏ID
    private Long playerId;           // 胜利者（如果有多名可用List<GamePlayer>）
    private int totalRounds;              // 游戏总轮数
}
