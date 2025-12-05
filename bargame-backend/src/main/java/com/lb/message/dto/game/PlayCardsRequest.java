package com.lb.message.dto.game;

import com.lb.entity.game.CardType;
import lombok.Data;
import java.util.List;

@Data
public class PlayCardsRequest {
    private Long gameId;
    private List<CardType> cards;   // ["Q", "Q", "A"] 等
}
