package com.lb.service.imp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lb.entity.Player;
import com.lb.entity.Room;
import com.lb.entity.game.*;
import com.lb.exp.CardException;
import com.lb.manager.ConnectionManager;
import com.lb.manager.GameManager;
import com.lb.manager.RoomManager;
import com.lb.manager.UserStateManager;
import com.lb.message.WebSocketMsg;
import com.lb.message.dto.game.StartGameRequest;
import com.lb.message.dto.game.PlayCardsRequest;
import com.lb.message.dto.game.ChallengeRequest;
import com.lb.message.dto.game.LeaveGameRequest;
import com.lb.message.vo.game.StartGameVO;
import com.lb.message.vo.game.PlayCardsVO;
import com.lb.message.vo.game.ChallengeResultVO;
import com.lb.message.vo.game.GameOverVO;
import com.lb.message.vo.game.PlayerSeatsVO;
import com.lb.message.vo.game.LeaveGameVO;
import com.lb.message.enums.CmdType;
import com.lb.message.enums.ModuleType;
import com.lb.net.ConnectionContext;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.List;
import static com.lb.entity.Room.RoomStatus.PLAYING;

@Component
@Slf4j
public class GameService {

    @Resource
    private GameManager gameManager;

    @Resource
    private RoomManager roomManager;

    @Resource
    private ConnectionManager connectionManager;

    @Resource
    private ObjectMapper objectMapper;

    @Resource
    private UserStateManager userStateManager;

    /**
     * 向游戏内所有玩家广播消息
     * @param gameId 游戏ID
     * @param message 要广播的消息
     * @return 成功发送的消息数量
     */
    public int broadcastToGame(Long gameId, WebSocketMsg<?> message) {
        try {
            // 获取游戏实例
            Game game = gameManager.getGame(gameId);
            if (game == null) {
                log.warn("游戏不存在，无法广播消息：gameId={}", gameId);
                return 0;
            }

            // 获取游戏中所有玩家ID
            List<Long> playerIds = gameManager.getGamePlayers(gameId);
            if (playerIds.isEmpty()) {
                log.warn("游戏中没有玩家，无法广播消息：gameId={}", gameId);
                return 0;
            }

            // 将消息序列化为JSON字符串
            String jsonMessage = objectMapper.writeValueAsString(message);
            int successCount = 0;

            // 向游戏中每个在线玩家发送消息
            for (Long playerId : playerIds) {
                if (connectionManager.isUserOnline(playerId)) {
                    boolean success = connectionManager.sendMessageToUser(playerId, jsonMessage);
                    if (success) {
                        successCount++;
                    } else {
                        log.warn("向游戏内玩家发送消息失败：gameId={}, playerId={}", gameId, playerId);
                    }
                } else {
                    log.warn("玩家离线，跳过发送：gameId={}, playerId={}", gameId, playerId);
                }
            }

            log.info("向游戏广播消息完成：gameId={}, 成功发送数={}, 目标玩家数={}",
                    gameId, successCount, playerIds.size());

            return successCount;

        } catch (Exception e) {
            log.error("向游戏广播消息失败：gameId={}, error={}", gameId, e.getMessage(), e);
            return 0;
        }
    }

    /**
     * 开始游戏
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> startGame(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 解析请求数据
            StartGameRequest request = objectMapper.convertValue(msg.getData(), StartGameRequest.class);
            if (request == null || request.getRoomId() == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        msg.getCmd(),
                        400,
                        "房间ID不能为空"
                );
            }

            Long roomId = request.getRoomId();

            // 从连接上下文中获取用户信息
            Long userId = connectionContext.getUserId();
            if (userId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.GAME, CmdType.START_GAME,
                        401, "用户未认证或连接无效");
            }

            Room currentRoom = roomManager.getRoomInfo(roomId);

             if (currentRoom == null) {
                 return WebSocketMsg.error(
                         msg.getRequestId(),
                         ModuleType.GAME,
                         msg.getCmd(),
                         404,
                         "房间不存在"
                 );
             }

             if (!roomManager.isPlayerInRoom(userId)) {
                 return WebSocketMsg.error(
                         msg.getRequestId(),
                         ModuleType.GAME,
                         msg.getCmd(),
                         403,
                         "您不在此房间中"
                 );
             }

             if (!currentRoom.isOwner(userId)) {
                 return WebSocketMsg.error(
                         msg.getRequestId(),
                         ModuleType.GAME,
                         msg.getCmd(),
                         403,
                         "只有房主可以开始游戏"
                 );
             }


            if (!currentRoom.areAllPlayersReady()) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        msg.getCmd(),
                        400,
                        "还有玩家未准备，无法开始游戏"
                );
            }

            // 校验房间内玩家数量是否足够开始游戏（至少需要2个玩家）
            if (currentRoom.getCurrentPlayerCount() < 2) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        msg.getCmd(),
                        400,
                        "房间内玩家数量不足，至少需要2个玩家才能开始游戏"
                );
            }


             if (gameManager.roomExists(roomId)) {
                 return WebSocketMsg.error(
                         msg.getRequestId(),
                         ModuleType.GAME,
                         msg.getCmd(),
                         400,
                         "游戏已经开始了"
                 );
             }

            // 使用GameManager创建游戏实例
            Game game = gameManager.createGame(roomId);
            if (game == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        msg.getCmd(),
                        500,
                        "创建游戏失败"
                );
            }
            game.startGame();
            currentRoom.setRoomStatus(PLAYING);

            // 先向所有玩家广播座位信息
            PlayerSeatsVO seatsVO = new PlayerSeatsVO();
            seatsVO.setGameId(game.getGameId());
            seatsVO.setPlayerIds(game.getPlayers().stream()
                    .map(GamePlayer::getPlayerId)
                    .collect(java.util.stream.Collectors.toList()));

            WebSocketMsg<PlayerSeatsVO> seatsMsg = WebSocketMsg.push(
                    ModuleType.GAME,
                    CmdType.PLAYER_SEATS,
                    seatsVO
            );

            broadcastToGame(game.getGameId(), seatsMsg);

            // 为每个玩家创建专属的StartGameVO并单独发送
            List<GamePlayer> allGamePlayers = game.getPlayers();
            int successCount = 0;

            for (GamePlayer gamePlayer : allGamePlayers) {
                try {
                    // 创建只包含当前玩家信息的StartGameVO
                    StartGameVO personalVO = new StartGameVO();
                    personalVO.setGameId(game.getGameId());
                    personalVO.setGamePlayers(gamePlayer); // 只设置当前玩家的信息
                    personalVO.setFirstPlayerId(game.getCurrentRound().getCurrentPlayer().getPlayerId());
                    personalVO.setTargetCardType(game.getCurrentRound().getTargetCardType());
                    personalVO.setRoundNumber(game.getCurrentRound().getRoundNumber());

                    // 创建给当前玩家的消息
                    WebSocketMsg<StartGameVO> personalMsg = WebSocketMsg.push(
                            ModuleType.GAME,
                            CmdType.GAME_STARTED,
                            personalVO
                    );

                    // 只向当前玩家发送消息
                    String jsonMessage = objectMapper.writeValueAsString(personalMsg);
                    boolean success = connectionManager.sendMessageToUser(gamePlayer.getPlayerId(), jsonMessage);

                    if (success) {
                        successCount++;
                        log.debug("成功向玩家发送游戏开始消息：playerId={}, gameId={}",
                                gamePlayer.getPlayerId(), game.getGameId());
                    } else {
                        log.warn("向玩家发送游戏开始消息失败：playerId={}, gameId={}",
                                gamePlayer.getPlayerId(), game.getGameId());
                    }
                } catch (Exception e) {
                    log.error("为玩家创建消息失败：playerId={}, error={}",
                            gamePlayer.getPlayerId(), e.getMessage(), e);
                }
            }

            log.info("个性化游戏开始广播完成，成功发送消息数: {}, 目标玩家数: {}",
                    successCount, allGamePlayers.size());

            log.info("游戏开始成功，房间ID: {}, 游戏ID: {}, 玩家数: {}",
                    roomId, game.getGameId(), game.getPlayers().size());

            // 返回游戏开始成功的响应
            return WebSocketMsg.response(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.START_GAME,
                    null
            );

        } catch (Exception e) {
            log.error("开始游戏失败: ", e);
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    msg.getCmd(),
                    500,
                    "开始游戏失败: " + e.getMessage()
            );
        }
    }

    /**
     * 玩家出牌
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> playCards(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 解析请求数据
            PlayCardsRequest request = objectMapper.convertValue(msg.getData(), PlayCardsRequest.class);
            if (request == null || request.getGameId() == null || request.getCards() == null || request.getCards().isEmpty()) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.PLAY_CARDS,
                        400,
                        "请求参数不完整"
                );
            }

            // 获取当前玩家ID
            Long playerId = connectionContext.getUserId();
            if (playerId == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.PLAY_CARDS,
                        400,
                        "用户未登录或连接异常"
                );
            }
            Long gameId = request.getGameId();

            // 获取游戏对象
            Game game = gameManager.getGame(gameId);
            if (game == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.PLAY_CARDS,
                        404,
                        "游戏不存在"
                );
            }

            // 检查游戏状态
            if (game.getStatus() != com.lb.entity.game.GameStatus.PLAYING) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.PLAY_CARDS,
                        400,
                        "游戏未在进行中"
                );
            }

            // 检查玩家是否在游戏中
            if (!game.hasPlayer(playerId)) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.PLAY_CARDS,
                        400,
                        "玩家不在此游戏中"
                );
            }

            // 转换CardType列表为Card对象列表
            List<Card> cardsToPlay = request.getCards().stream()
                    .map(Card::new)
                    .collect(java.util.stream.Collectors.toList());

            // 获取玩家对象
            GamePlayer gamePlayer = game.getPlayerByPlayerId(playerId);
            if (gamePlayer == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.PLAY_CARDS,
                        400,
                        "玩家在游戏中不存在"
                );
            }

            // 执行出牌逻辑
            game.playCards(playerId, cardsToPlay);

            // 构造返回数据
            PlayCardsVO playCardsVO = new PlayCardsVO();
            playCardsVO.setGameId(gameId);
            playCardsVO.setRoundNumber(game.getRoundNumber());
            playCardsVO.setPlayerId(playerId);
            playCardsVO.setCardsCount(cardsToPlay.size());
            playCardsVO.setRemainingCards(gamePlayer.getHandCards().size());
            playCardsVO.setNextPlayerId(game.getCurrentRound().getCurrentPlayer().getPlayerId());

            // 构造响应消息
            WebSocketMsg<PlayCardsVO> response = WebSocketMsg.response(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.PLAYER_PLAYED,
                    playCardsVO
            );

            // 向游戏中所有玩家广播出牌结果
            broadcastToGame(gameId, response);

            return WebSocketMsg.response(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.PLAY_CARDS,
                    "出牌成功"
            );

        }catch (CardException e) {
            log.warn("对手已无手牌，必须质疑而不是出牌: {}", e.getMessage());
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.PLAY_CARDS,
                    200,
                    "对手已无手牌，必须质疑而不是出牌"
            );
        }
        catch (IllegalArgumentException e) {
            log.warn("玩家出牌失败，参数错误: {}", e.getMessage());
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.PLAY_CARDS,
                    400,
                    "出牌失败: " + e.getMessage()
            );
        } catch (Exception e) {
            log.error("玩家出牌异常: ", e);
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.PLAY_CARDS,
                    500,
                    "出牌异常: " + e.getMessage()
            );
        }
    }

    /**
     * 玩家质疑
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> challenge(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 解析请求数据
            ChallengeRequest request = objectMapper.convertValue(msg.getData(), ChallengeRequest.class);
            if (request == null || request.getGameId() == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.CHALLENGE,
                        400,
                        "游戏ID不能为空"
                );
            }

            // 获取当前玩家ID
            Long playerId = connectionContext.getUserId();
            if (playerId == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.CHALLENGE,
                        400,
                        "用户未登录或连接异常"
                );
            }
            Long gameId = request.getGameId();

            // 获取游戏对象
            Game game = gameManager.getGame(gameId);
            if (game == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.CHALLENGE,
                        404,
                        "游戏不存在"
                );
            }

            // 检查游戏状态
            if (game.getStatus() != com.lb.entity.game.GameStatus.PLAYING) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.CHALLENGE,
                        400,
                        "游戏未在进行中"
                );
            }

            // 检查玩家是否在游戏中
            if (!game.hasPlayer(playerId)) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.CHALLENGE,
                        400,
                        "玩家不在此游戏中"
                );
            }

            // 在质疑前获取当前轮次的基本信息
            int currentRoundNumber = game.getRoundNumber();
            Round currentRoundBeforeChallenge = game.getCurrentRound();

            // 获取质疑前的轮次信息
            Long lastPlayerId = null;
            List<Card> playedCards = null;
            if (currentRoundBeforeChallenge != null && currentRoundBeforeChallenge.getLastPlayRecord() != null) {
                lastPlayerId = currentRoundBeforeChallenge.getLastPlayRecord().getPlayer().getPlayerId();
                playedCards = currentRoundBeforeChallenge.getLastPlayRecord().getCards();
            }

            // 执行质疑逻辑（质疑后会自动开启新轮次）
            game.challenge(playerId);

            // 汇总质疑结果数据
            ChallengeResultVO challengeResultVO = new ChallengeResultVO();
            challengeResultVO.setGameId(gameId);
            challengeResultVO.setRoundNumber(currentRoundNumber); // 使用质疑前的轮次号
            challengeResultVO.setLastPlayerId(lastPlayerId);
            challengeResultVO.setPlayedCards(playedCards);

            // 获取质疑结果信息 - 从Game对象中获取上一轮输家信息
            if (game.getLastRoundLoser() != null) {
                challengeResultVO.setLoserId(game.getLastRoundLoser().getPlayerId());
                challengeResultVO.setLoserDead(!game.getLastRoundLoser().isAlive());
            }

            // 构造质疑结果广播消息
            WebSocketMsg<ChallengeResultVO> challengeResponse = WebSocketMsg.push(
                    ModuleType.GAME,
                    CmdType.CHALLENGE_RESULT,
                    challengeResultVO
            );

            // 向游戏中所有玩家广播质疑结果
            broadcastToGame(gameId, challengeResponse);

            // 检查游戏是否结束
            if (game.getStatus() == GameStatus.FINISHED) {
                // 游戏结束，发送游戏结束通知
                Long WinnerId = game.getWinner().getPlayerId();
                GameOverVO gameOverVO = new GameOverVO();
                gameOverVO.setGameId(gameId);
                gameOverVO.setPlayerId(WinnerId);
                gameOverVO.setTotalRounds(game.getRoundNumber());

                WebSocketMsg<GameOverVO> gameOverResponse = WebSocketMsg.push(
                        ModuleType.GAME,
                        CmdType.GAME_FINISHED,
                        gameOverVO
                );

                broadcastToGame(gameId, gameOverResponse);

                log.info("游戏结束，游戏ID: {}, 获胜者: {}, 总轮数: {}",
                        gameId, WinnerId, game.getRoundNumber());

                //清理游戏状态
                game.endGame();
                gameManager.cleanupGame(gameId);
            } else {
                // 游戏继续，为下一轮创建个性化数据并分别发送给玩家
                List<GamePlayer> currentGamePlayers = game.getPlayers();
                int successCount = 0;

                for (GamePlayer gamePlayer : currentGamePlayers) {
                    try {
                        // 创建只包含当前玩家信息的StartGameVO用于新一轮
                        StartGameVO nextRoundVO = new StartGameVO();
                        nextRoundVO.setGameId(gameId);
                        nextRoundVO.setGamePlayers(gamePlayer); // 只设置当前玩家的信息
                        nextRoundVO.setFirstPlayerId(game.getCurrentRound().getCurrentPlayer().getPlayerId());
                        nextRoundVO.setTargetCardType(game.getCurrentRound().getTargetCardType());
                        nextRoundVO.setRoundNumber(game.getCurrentRound().getRoundNumber());

                        // 创建给当前玩家的消息
                        WebSocketMsg<StartGameVO> nextRoundMsg = WebSocketMsg.push(
                                ModuleType.GAME,
                                CmdType.NEW_ROUND,
                                nextRoundVO
                        );

                        // 只向当前玩家发送消息
                        String jsonMessage = objectMapper.writeValueAsString(nextRoundMsg);
                        boolean success = connectionManager.sendMessageToUser(gamePlayer.getPlayerId(), jsonMessage);

                        if (success) {
                            successCount++;
                            log.debug("成功向玩家发送新一轮消息：playerId={}, gameId={}, roundNumber={}",
                                    gamePlayer.getPlayerId(), gameId, game.getCurrentRound().getRoundNumber());
                        } else {
                            log.warn("向玩家发送新一轮消息失败：playerId={}, gameId={}",
                                    gamePlayer.getPlayerId(), gameId);
                        }
                    } catch (Exception e) {
                        log.error("为玩家创建新一轮消息失败：playerId={}, error={}",
                                gamePlayer.getPlayerId(), e.getMessage(), e);
                    }
                }

                log.info("新一轮个性化广播完成，成功发送消息数: {}, 目标玩家数: {}",
                        successCount, currentGamePlayers.size());
            }

                        // 返回出牌成功的响应
            return WebSocketMsg.response(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.PLAY_CARDS,
                    "质疑成功"
            );

        } catch (IllegalArgumentException e) {
            log.warn("玩家质疑失败，参数错误: {}", e.getMessage());
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.CHALLENGE,
                    400,
                    "质疑失败: " + e.getMessage()
            );
        } catch (Exception e) {
            log.error("玩家质疑异常: ", e);
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.CHALLENGE,
                    500,
                    "质疑异常: " + e.getMessage()
            );
        }
    }

    public WebSocketMsg<?> leaveGame(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 解析请求数据
            LeaveGameRequest request = objectMapper.convertValue(msg.getData(), LeaveGameRequest.class);
            if (request == null || request.getGameId() == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.LEAVE_GAME,
                        400,
                        "游戏ID不能为空"
                );
            }

            // 获取当前玩家ID
            Long playerId = connectionContext.getUserId();
            if (playerId == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.LEAVE_GAME,
                        400,
                        "用户未登录或连接异常"
                );
            }
            Long gameId = request.getGameId();

            // 获取游戏对象
            Game game = gameManager.getGame(gameId);
            if (game == null) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.LEAVE_GAME,
                        404,
                        "游戏不存在"
                );
            }

            // 检查游戏状态
            if (game.getStatus() != com.lb.entity.game.GameStatus.PLAYING) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.LEAVE_GAME,
                        400,
                        "游戏未在进行中"
                );
            }

            // 检查玩家是否在游戏中
            if (!game.hasPlayer(playerId)) {
                return WebSocketMsg.error(
                        msg.getRequestId(),
                        ModuleType.GAME,
                        CmdType.LEAVE_GAME,
                        400,
                        "玩家不在此游戏中"
                );
            }

            // 记录当前轮次号（在调用leaveGame之前）
            int currentRoundNumber = game.getRoundNumber();

            // 执行离开游戏逻辑
            boolean handled = game.leaveGame(playerId);
            
            // 更新玩家状态
            Player player = userStateManager.getUserState(playerId);
            if (player != null) {
                player.leaveGame();
                userStateManager.addOrUpdateUserState(playerId, player);
            }
            
            // 清理玩家状态
            gameManager.leaveGame(playerId);

            // 广播玩家离开游戏的消息
            LeaveGameVO leaveGameVO = new LeaveGameVO();
            leaveGameVO.setGameId(gameId);
            leaveGameVO.setRoundNumber(currentRoundNumber);
            leaveGameVO.setLeavePlayerId(playerId);

            WebSocketMsg<LeaveGameVO> leaveResponse = WebSocketMsg.push(
                    ModuleType.GAME,
                    CmdType.GAME_LEAVE,
                    leaveGameVO
            );

            // 向游戏中所有玩家广播离开消息
            broadcastToGame(gameId, leaveResponse);

            // 检查游戏是否结束
            if (game.getStatus() == GameStatus.FINISHED) {
                // 游戏结束，发送游戏结束通知
                Long winnerId = game.getWinner() != null ? game.getWinner().getPlayerId() : null;
                GameOverVO gameOverVO = new GameOverVO();
                gameOverVO.setGameId(gameId);
                gameOverVO.setPlayerId(winnerId);
                gameOverVO.setTotalRounds(game.getRoundNumber());

                WebSocketMsg<GameOverVO> gameOverResponse = WebSocketMsg.push(
                        ModuleType.GAME,
                        CmdType.GAME_FINISHED,
                        gameOverVO
                );

                broadcastToGame(gameId, gameOverResponse);

                log.info("游戏结束，游戏ID: {}, 获胜者: {}, 总轮数: {}",
                        gameId, winnerId, game.getRoundNumber());

                //清理游戏状态
                game.endGame();
                gameManager.cleanupGame(gameId);
            } else {
                // 游戏继续，为下一轮创建个性化数据并分别发送给玩家
                List<GamePlayer> currentGamePlayers = game.getPlayers();
                int successCount = 0;

                for (GamePlayer gamePlayer : currentGamePlayers) {
                    try {
                        // 创建只包含当前玩家信息的StartGameVO用于新一轮
                        StartGameVO nextRoundVO = new StartGameVO();
                        nextRoundVO.setGameId(gameId);
                        nextRoundVO.setGamePlayers(gamePlayer); // 只设置当前玩家的信息
                        nextRoundVO.setFirstPlayerId(game.getCurrentRound().getCurrentPlayer().getPlayerId());
                        nextRoundVO.setTargetCardType(game.getCurrentRound().getTargetCardType());
                        nextRoundVO.setRoundNumber(game.getCurrentRound().getRoundNumber());

                        // 创建给当前玩家的消息
                        WebSocketMsg<StartGameVO> nextRoundMsg = WebSocketMsg.push(
                                ModuleType.GAME,
                                CmdType.NEW_ROUND,
                                nextRoundVO
                        );

                        // 只向当前玩家发送消息
                        String jsonMessage = objectMapper.writeValueAsString(nextRoundMsg);
                        boolean success = connectionManager.sendMessageToUser(gamePlayer.getPlayerId(), jsonMessage);

                        if (success) {
                            successCount++;
                            log.debug("成功向玩家发送新一轮消息：playerId={}, gameId={}, roundNumber={}",
                                    gamePlayer.getPlayerId(), gameId, game.getCurrentRound().getRoundNumber());
                        } else {
                            log.warn("向玩家发送新一轮消息失败：playerId={}, gameId={}",
                                    gamePlayer.getPlayerId(), gameId);
                        }
                    } catch (Exception e) {
                        log.error("为玩家创建新一轮消息失败：playerId={}, error={}",
                                gamePlayer.getPlayerId(), e.getMessage(), e);
                    }
                }

                log.info("新一轮个性化广播完成，成功发送消息数: {}, 目标玩家数: {}",
                        successCount, currentGamePlayers.size());
            }

            // 返回离开游戏成功的响应
            return WebSocketMsg.response(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.LEAVE_GAME,
                    "离开游戏成功"
            );

        } catch (IllegalArgumentException e) {
            log.warn("玩家离开游戏失败，参数错误: {}", e.getMessage());
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.LEAVE_GAME,
                    400,
                    "离开游戏失败: " + e.getMessage()
            );
        } catch (Exception e) {
            log.error("玩家离开游戏异常: ", e);
            return WebSocketMsg.error(
                    msg.getRequestId(),
                    ModuleType.GAME,
                    CmdType.LEAVE_GAME,
                    500,
                    "离开游戏异常: " + e.getMessage()
            );
        }
    }
}
