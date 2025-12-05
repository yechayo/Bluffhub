package com.lb.manager;

import com.lb.entity.Player;
import com.lb.entity.game.*;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 游戏管理器 - 管理所有游戏实例
 * 负责创建、查找、管理游戏房间和游戏状态
 */
@Service
@Data
public class GameManager {

    // 依赖注入
    @Autowired
    private RoomManager roomManager;

    // 游戏ID生成器，从1001开始
    private long gameIdSequence = 1001;

    // 存储所有游戏实例 gameId -> Game
    private final Map<Long, Game> gameMap = new ConcurrentHashMap<>();

    // 玩家ID到游戏ID的映射 playerId -> gameId
    private final Map<Long, Long> playerGameMap = new ConcurrentHashMap<>();

    // 房间ID到游戏ID的映射 roomId -> gameId
    private final Map<Long, Long> roomGameMap = new ConcurrentHashMap<>();

    /**
     * 创建新游戏
     * @param roomId 房间ID
     * @return 创建的游戏实例
     */
    public Game createGame(Long roomId) {
        // 自动生成游戏ID
        Long gameId = generateGameId();
        Game game = new Game(gameId);

        // 将房间内的玩家转换为GamePlayer并添加到游戏中
        Collection<Player> roomPlayers = roomManager.getRoomPlayers(roomId);
        for (Player player : roomPlayers) {
            // 只有在线玩家才能加入游戏
            if (player.isOnline()) {
                GamePlayer gamePlayer = new GamePlayer(player.getUserId());
                game.addPlayer(gamePlayer);
                playerGameMap.put(player.getUserId(), gameId);
            }
        }

        gameMap.put(gameId, game);
        roomGameMap.put(roomId, gameId);
        return game;
    }

    /**
     * 生成唯一的游戏ID
     * @return 新的游戏ID
     */
    private synchronized Long generateGameId() {
        return gameIdSequence++; // 线程安全的自增ID生成
    }

    /**
     * 根据游戏ID获取游戏
     */
    public Game getGame(Long gameId) {
        return gameMap.get(gameId);
    }

    /**
     * 根据房间ID获取游戏
     */
    public Game getGameByRoom(Long roomId) {
        Long gameId = roomGameMap.get(roomId);
        return gameId != null ? gameMap.get(gameId) : null;
    }

    /**
     * 根据玩家ID获取所在游戏
     */
    public Game getGameByPlayer(long playerId) {
        Long gameId = playerGameMap.get(playerId);
        return gameId != null ? gameMap.get(gameId) : null;
    }



    /**
     * 玩家离开游戏
     */
    public void leaveGame(long playerId) {
        Long gameId = playerGameMap.get(playerId);
        if (gameId != null) {
            Game game = gameMap.get(gameId);
            if (game != null) {
                // 使用新的removePlayer方法，同时从列表和映射中移除
                game.removePlayer(playerId);
            }

            // 清理玩家映射
            playerGameMap.remove(playerId);
        }
    }

    /**
     * 清理游戏实例
     */
    public void cleanupGame(Long gameId) {
        Game game = gameMap.remove(gameId);
        if (game != null) {
            // 清理房间映射
            roomGameMap.entrySet().removeIf(entry -> gameId.equals(entry.getValue()));

            // 清理所有玩家映射
            playerGameMap.entrySet().removeIf(entry -> gameId.equals(entry.getValue()));
        }
    }

    /**
     * 获取游戏状态摘要
     */
    public GameStatus getGameStatus(Long gameId) {
        Game game = gameMap.get(gameId);
        return game != null ? game.getStatus() : null;
    }

    /**
     * 获取游戏中的所有玩家ID
     */
    public List<Long> getGamePlayers(Long gameId) {
        Game game = gameMap.get(gameId);
        return game != null ?
            game.getPlayers().stream().map(GamePlayer::getPlayerId).collect(Collectors.toList()) :
            Collections.emptyList();
    }

    /**
     * 检查玩家是否在游戏中
     */
    public boolean isPlayerInGame(long playerId) {
        return playerGameMap.containsKey(playerId);
    }

    public Long getPlayerGameId(Long playerId) {
        return playerGameMap.get(playerId);
    }

    /**
     * 检查游戏是否存在
     */
    public boolean gameExists(Long gameId) {
        return gameMap.containsKey(gameId);
    }

    public boolean roomExists(Long roomId) {
        return roomGameMap.containsKey(roomId);
    }

    /**
     * 获取当前轮次的当前玩家
     */
    public Long getCurrentPlayer(Long gameId) {
        Game game = gameMap.get(gameId);
        if (game != null && game.getCurrentRound() != null) {
            GamePlayer currentPlayer = game.getCurrentRound().getCurrentPlayer();
            return currentPlayer != null ? currentPlayer.getPlayerId() : null;
        }
        return null;
    }

    /**
     * 获取所有活跃游戏列表
     */
    public List<Long> getActiveGames() {
        return new ArrayList<>(gameMap.keySet());
    }

    /**
     * 清理所有已结束的游戏
     */
    public void cleanupFinishedGames() {
        List<Long> finishedGames = gameMap.entrySet().stream()
            .filter(entry -> entry.getValue().getStatus() == GameStatus.FINISHED)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

        finishedGames.forEach(this::cleanupGame);
    }
}