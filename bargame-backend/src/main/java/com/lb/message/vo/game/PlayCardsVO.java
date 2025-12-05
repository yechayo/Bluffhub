package com.lb.message.vo.game;

import lombok.Data;

@Data
public class PlayCardsVO {
    private Long gameId;         // 游戏ID
    private Integer roundNumber; // 轮次编号
    private Long playerId;       // 出牌玩家（必须包含，前端需要知道谁出牌）
    private int cardsCount;      // 出牌数量（不要包含牌面明文）
    private int remainingCards;  // 出牌玩家剩余手牌数
    private Long nextPlayerId;   // 下一个应出牌的玩家ID（方便前端直接高亮）
}
