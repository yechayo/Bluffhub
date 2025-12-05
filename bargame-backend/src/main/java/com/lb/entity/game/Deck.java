package com.lb.entity.game;

import java.util.*;

public class Deck {
    private List<Card> cards = new ArrayList<>();

    public Deck() {
        initializeDeck();
        Collections.shuffle(cards);
    }

    private void initializeDeck() {
        // 按规则创建20张牌：6Q + 6K + 6A + 2JOKER
        for (int i = 0; i < 6; i++) {
            cards.add(new Card(CardType.Q));
            cards.add(new Card(CardType.K));
            cards.add(new Card(CardType.A));
        }
        cards.add(new Card(CardType.JOKER));
        cards.add(new Card(CardType.JOKER));
    }

    public List<Card> dealCards(int count) {
        List<Card> hand = new ArrayList<>();
        for (int i = 0; i < count && !cards.isEmpty(); i++) {
            hand.add(cards.remove(0));
        }
        return hand;
    }

    public boolean isEmpty() {
        return cards.isEmpty();
    }
}
