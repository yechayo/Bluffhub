package com.lb.entity.game;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

// 出牌记录类
@Data
public class PlayRecord {
    private GamePlayer player;      // 出牌的玩家
    private List<Card> cards;       // 实际出的牌

    public PlayRecord(GamePlayer player, List<Card> cards) {
        this.player = player;
        this.cards = new ArrayList<>(cards);
    }
}