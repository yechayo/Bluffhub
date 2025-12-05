package com.lb.message.vo.game;

import com.lb.entity.game.Card;
import com.lb.entity.game.CardType;
import lombok.Data;

import java.util.List;

@Data
public class ChallengeResultVO {

    private Long gameId;                  // 当前游戏ID
    private int roundNumber;              // 当前轮次

    private Long lastPlayerId;            // 上家出牌玩家ID
    private List<Card> playedCards;       // 上家出的牌

    private Long loserId;                 // 输家玩家ID（开枪者）
    private boolean loserDead;            // 输家是否死亡


}
