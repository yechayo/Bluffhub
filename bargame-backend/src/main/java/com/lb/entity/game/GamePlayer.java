package com.lb.entity.game;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Data
public class GamePlayer {
    private long playerId;

    private List<Card> handCards = new ArrayList<>();

    private boolean alive = true;

    @JsonIgnore  // 不序列化左轮信息，防止被前端看到
    private boolean[] revolver;

    @JsonIgnore  // 不序列化当前位置信息
    private int currentSlot = 0;

    public GamePlayer(long playerId) {
        this.playerId = playerId;
        // 初始化左轮：随机一个槽位放一颗子弹
        reloadRevolver();
    }

    public void reloadRevolver() {
        revolver = new boolean[6];
        int bulletIndex = new Random().nextInt(6);
        revolver[bulletIndex] = true;
        currentSlot = 0; // 重置当前槽位到起始位置
    }

    public boolean shoot() {
        // 从当前槽位开枪，然后递增槽位索引（循环到0）
        boolean result = revolver[currentSlot];
        currentSlot = (currentSlot + 1) % 6;
        return result;
    }

    public void removeCards(List<Card> cards) {
        for (Card cardToRemove : cards) {
            boolean found = false;
            // 遍历手牌找到第一个匹配的牌并移除
            for (int i = 0; i < handCards.size(); i++) {
                if (handCards.get(i).equals(cardToRemove)) {
                    handCards.remove(i);
                    found = true;
                    break; // 只移除一张匹配的牌
                }
            }
            if (!found) {
                throw new IllegalArgumentException("手牌中没有找到要移除的牌: " + cardToRemove.getType());
            }
        }
    }

    public boolean hasNoCards() {
        return handCards.isEmpty();
    }

    /**
     * 计算当前剩余的子弹数量
     * @return 剩余子弹数，指针指向0还剩6发，指向1还剩5发，以此类推
     */
    public Long getBulletCount() {
        // 从当前槽位开始，计算还剩下多少个槽位没有检查过
        return (long) (6 - currentSlot);
    }

        /**
     * 清理玩家状态，解除所有对象引用以便GC回收
     * 确保没有内存泄漏
     */
    public void clearPlayerState() {
        try {
            // 1. 清理手牌
            if (handCards != null) {
                handCards.clear();
                handCards = null;
            }

            // 2. 清理左轮信息
            if (revolver != null) {
                revolver = null;
            }

            // 3. 重置状态标志
            this.alive = false; // 设为死亡，游戏结束状态
            this.currentSlot = 0;

        } catch (Exception e) {
            System.err.println("清理玩家状态时发生异常， playerId: " + playerId + ", error: " + e.getMessage());
            e.printStackTrace();
        }
    }


}
