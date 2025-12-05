package com.lb.message.vo.game;

import com.lb.entity.game.CardType;
import com.lb.entity.game.GamePlayer;
import lombok.Data;


@Data
public class StartGameVO {

    private Long gameId;                   // 游戏 ID

    private GamePlayer gamePlayers;       //每个玩家只返回自己的对象

    private Long firstPlayerId;            // 第一个出牌的人，前端需要高亮

    private CardType targetCardType;       // 本轮目标牌（Q/K/A）

    private int roundNumber;               // 当前轮次
}
