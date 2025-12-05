package com.lb.entity.game;

import com.lb.exp.CardException;
import lombok.Data;

import java.util.List;
import java.util.Random;

@Data
public class Round {
    private List<GamePlayer> players; // 当前轮参与的玩家
    private int currentIndex;   // 当前玩家轮到谁
    private CardType targetCardType;   // 本轮目标牌
    private PlayRecord lastPlayRecord; // 上一轮出牌记录
    private GamePlayer challenger;     // 质疑者
    private GamePlayer currentLoser;   //当前轮次的输者
    private int roundNumber; // 轮次编号

    public Round(List<GamePlayer> players, GamePlayer lastRoundLoser, int roundNumber) {
        this.players = players;
        this.roundNumber = roundNumber;
        // Round自己选择目标牌
        this.targetCardType = CardType.values()[new Random().nextInt(3)]; // Q/K/A;

        // 选择起手玩家：上一轮输家存活则由他开始，否则随机
        if (lastRoundLoser != null && players.contains(lastRoundLoser)) {
            this.currentIndex = players.indexOf(lastRoundLoser);
        } else {
            this.currentIndex = new Random().nextInt(players.size());
        }

        // 为本轮创建新的牌堆并发牌
        Deck roundDeck = new Deck();
        for (GamePlayer player : this.players) {
            // 清空旧牌并发新牌
            player.getHandCards().clear();
            player.getHandCards().addAll(roundDeck.dealCards(5));
        }
    }

    public GamePlayer getCurrentPlayer() {
        return players.get(currentIndex);
    }

    public void playCards(GamePlayer player, List<Card> cards) {
        if (player != getCurrentPlayer()) {
            throw new IllegalStateException("不是当前玩家回合");
        }
        
                // 检查当前玩家是否有手牌
        if (player.hasNoCards()) {
            throw new CardException("当前玩家已无手牌，应跳过该玩家回合");
        }

        if (cards.size() > 3 || cards.isEmpty()) {
            throw new IllegalStateException("非法出牌数量");
        }

        // 检查边界情况：只有两名玩家且另一个玩家手牌为0
        if (players.size() == 2) {
            for (GamePlayer otherPlayer : players) {
                if (otherPlayer != player && otherPlayer.hasNoCards()) {
                    throw new CardException("对手已无手牌，必须质疑而不是出牌");
                }
            }
        }

        // 记录出牌（覆盖上一轮记录）
        lastPlayRecord = new PlayRecord(player, cards);

        // 从玩家手牌中移除
        player.removeCards(cards);
    }

    public void challenge(GamePlayer challenger) {
        if (challenger != getCurrentPlayer()) {
            throw new IllegalStateException("不是当前玩家回合");
        }

        // 检查是否有人出牌
        if (lastPlayRecord == null) {
            throw new IllegalStateException("还没有人出牌，无法质疑");
        }

        // 不能质疑自己的出牌
        if (challenger == lastPlayRecord.getPlayer()) {
            throw new IllegalStateException("不能质疑自己的出牌");
        }

        this.challenger = challenger;

        // 判断上家出牌是否真实（是否为目标牌或JOKER）
        boolean real = lastPlayRecord.getCards().stream().allMatch(c ->
                c.getType() == targetCardType || c.getType() == CardType.JOKER
        );

        GamePlayer lastPlayer = lastPlayRecord.getPlayer();
        currentLoser = real ? challenger : lastPlayer;

        boolean hit = currentLoser.shoot();
        if (hit) {
            currentLoser.setAlive(false);
        }
    }

    
    public void nextPlayer() {
        int attempts = 0;

        do {
            // 固定顺时针：索引递增
            currentIndex = (currentIndex + 1) % players.size();

            attempts++;

            // 防止无限循环：如果检查了所有玩家，则停止
            if (attempts >= players.size()) {
                break;
            }

        } while (players.get(currentIndex).hasNoCards()); // 跳过无牌玩家
    }

    public boolean isRoundFinished() {
        // 当有人质疑后，本轮就结束了（不管是否有人死亡）
        return challenger != null;
    }

        /**
     * 清理回合状态，解除所有对象引用以便GC回收
     * 确保没有内存泄漏
     */
    public void clearRound() {
        try {
            // 1. 清理玩家列表
            if (players != null) {
                players.clear();
                players = null;
            }

            // 2. 重置索引
            this.currentIndex = 0;

            // 3. 清理目标牌类型
            this.targetCardType = null;

            // 4. 清理出牌记录
            if (lastPlayRecord != null) {
                lastPlayRecord = null;
            }

            // 5. 清理质疑者和输家引用
            this.challenger = null;
            this.currentLoser = null;


            // 7. 重置轮次编号
            this.roundNumber = 0;

        } catch (Exception e) {
            System.err.println("清理回合状态时发生异常， error: " + e.getMessage());
            e.printStackTrace();
        }
    }

}

