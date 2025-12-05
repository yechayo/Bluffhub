package com.lb.entity.game;

import com.lb.entity.Player;
import com.lb.util.SpringContextHolder;
import com.lb.manager.ConnectionManager;
import lombok.Data;

import java.util.*;
import java.util.stream.Collectors;

@Data
public class Game {
    private Long gameId;
    private List<GamePlayer> players = new ArrayList<>();
    private Map<Long, GamePlayer> playerMap = new HashMap<>(); // playerId到GamePlayer的映射
    private GameStatus status = GameStatus.WAITING;
    private Round currentRound;
    private GamePlayer lastRoundLoser; // 上一轮的输家
    private GamePlayer winner;   //胜利者
    private int roundNumber = 1; // 轮次编号，从1开始

    public Game(Long gameId) {
        this.gameId = gameId;
    }

    public void addPlayer(GamePlayer player) {
        players.add(player);
        playerMap.put(player.getPlayerId(), player);
    }

    public void startGame() {
        status = GameStatus.PLAYING;
        // 创建第一轮（在Round构造函数中处理洗牌发牌和选择目标牌）
        startNewRound();
    }

    public synchronized void playCards(long playerId, List<Card> cards) {
        GamePlayer player = findPlayer(playerId);
        currentRound.playCards(player, cards);
        // 出牌本身不会结束轮次，只有质疑才会结束轮次
        // 所以直接切换到下一个玩家
        currentRound.nextPlayer();
    }

    public synchronized void challenge(long challengerId) {
        GamePlayer challenger = findPlayer(challengerId);
        currentRound.challenge(challenger);
        if (currentRound.isRoundFinished()) {
            // 记录本轮输家
            lastRoundLoser = currentRound.getCurrentLoser();
            checkWin();
            if (status != GameStatus.FINISHED) {
                roundNumber++; // 轮次递增
                startNewRound();
            }
        }
    }

    private void startNewRound() {
        // 创建新轮次（Round内部会处理洗牌发牌和选择目标牌）
        currentRound = new Round(players.stream().filter(GamePlayer::isAlive).collect(Collectors.toList()), lastRoundLoser, roundNumber);
    }

    private void checkWin() {
        long aliveCount = players.stream().filter(GamePlayer::isAlive).count();
        if (aliveCount <= 1) {
            status = GameStatus.FINISHED;
            // 设置获胜者为唯一存活的玩家，如果没有存活的玩家则设为null
            winner = players.stream().filter(GamePlayer::isAlive).findFirst().orElse(null);
        }
    }

    private GamePlayer findPlayer(long playerId) {
        GamePlayer player = playerMap.get(playerId);
        if (player == null) {
            throw new IllegalArgumentException("玩家不存在，playerId: " + playerId);
        }
        return player;
    }

    /**
     * 根据playerId获取GamePlayer，公开方法供外部调用
     */
    public GamePlayer getPlayerByPlayerId(long playerId) {
        return playerMap.get(playerId);
    }

    /**
     * 检查玩家是否在游戏中
     */
    public boolean hasPlayer(long playerId) {
        return playerMap.containsKey(playerId);
    }

    /**
     * 玩家离开游戏处理逻辑
     * @param playerId 离开游戏的玩家ID
     * @return true 表示玩家成功离开，false 表示玩家已在死亡状态无需处理
     */
    public synchronized boolean leaveGame(long playerId) {
        GamePlayer leavingPlayer = findPlayer(playerId);

        // 检查是否为死去玩家，如果是死去玩家那么什么都不用做
        if (!leavingPlayer.isAlive()) {
            return false;
        }

        // 如果是活着的玩家，直接判定为该玩家死亡
        leavingPlayer.setAlive(false);

        checkWin();

        if (status == GameStatus.FINISHED) {
            // 游戏结束，记录获胜者
            winner = players.stream().filter(GamePlayer::isAlive).findFirst().orElse(null);
            return true;
        }

        // 如果游戏未结束，当前轮次结束，剩余活着的玩家开启下一轮
        if (currentRound != null) {
            // 记录当前轮次的输家（离开的玩家）
            lastRoundLoser = leavingPlayer;

            // 轮次递增
            roundNumber++;

            // 开启新轮次（只包含存活玩家）
            startNewRound();
        }

        return true;
    }

    /**
     * 移除玩家（玩家离线等场景）
     */
    public GamePlayer removePlayer(long playerId) {
        GamePlayer player = playerMap.remove(playerId);
        if (player != null) {
            players.remove(player);
        }
        return player;
    }

    /**
     * 获取当前轮次的目标牌类型
     * @return 当前轮次的目标牌，如果没有进行中的轮次返回null
     */
    public CardType getCurrentTargetCardType() {
        return currentRound != null ? currentRound.getTargetCardType() : null;
    }

    /**
     * 游戏结束时清理所有状态，解除所有对象引用以便GC回收
     * 确保没有内存泄漏，同时更新玩家状态
     */
    public void endGame() {
        System.out.println("开始清理游戏状态， gameId: " + gameId);

        try {
            // 获取ConnectionManager来更新玩家状态
            ConnectionManager connectionManager = SpringContextHolder.getConnectionManager();

            // 1. 更新所有玩家的状态：将LocationType从GAME改回ROOM
            if (players != null) {
                for (GamePlayer gamePlayer : players) {
                    if (gamePlayer != null) {
                        try {
                            // 通过ConnectionManager获取对应的Player对象
                            Player player = connectionManager.getPlayerByUserId(gamePlayer.getPlayerId());
                            if (player != null&&player.getLocationType().equals(Player.LocationType.GAME)) {
                                // 更新位置：从游戏中回到房间
                                player.setLocationType(Player.LocationType.ROOM);
                                // 清理游戏相关数据
                                player.setSessionId(null);
                                player.setSeatNumber(-1);
                                player.setHandCards(null);
                                player.setActionHistory(null);

                                System.out.println("玩家状态已更新， playerId: " + gamePlayer.getPlayerId() +
                                                 ", LocationType: ROOM");
                            }
                        } catch (Exception e) {
                            System.err.println("更新玩家状态失败， playerId: " + gamePlayer.getPlayerId() +
                                             ", error: " + e.getMessage());
                        }

                        // 清理GamePlayer内部状态
                        gamePlayer.clearPlayerState();
                    }
                }

                // 清理玩家列表
                players.clear();
                players = null;
            }

            // 2. 重置游戏状态
            this.status = GameStatus.WAITING;

            // 3. 清理玩家映射表
            if (playerMap != null) {
                playerMap.clear();
                playerMap = null;
            }

            // 4. 清理当前回合对象
            if (currentRound != null) {
                currentRound.clearRound();
                currentRound = null;
            }

            // 5. 清理输家和赢家引用
            this.lastRoundLoser = null;
            this.winner = null;

            // 6. 重置轮次编号
            this.roundNumber = 1;

            System.out.println("游戏状态清理完成， gameId: " + gameId);

        } catch (Exception e) {
            System.err.println("清理游戏状态时发生异常， gameId: " + gameId + ", error: " + e.getMessage());
            e.printStackTrace();
        }
    }

}
