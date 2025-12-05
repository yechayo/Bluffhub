package com.lb.net.netty.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lb.dispatcher.Dispatcher;
import com.lb.entity.UserEntity;
import com.lb.entity.Player;
import com.lb.entity.Room;
import com.lb.entity.game.Game;
import com.lb.entity.game.GamePlayer;
import com.lb.manager.ConnectionManager;
import com.lb.manager.GameManager;
import com.lb.manager.RoomManager;
import com.lb.mapper.UserMapper;
import com.lb.net.netty.context.NettyConnectionContext;
import com.lb.net.netty.auth.HandshakeAuthHandler;
import com.lb.net.ConnectionContext;
import com.lb.message.WebSocketMsg;
import com.lb.message.dto.game.LeaveGameRequest;
import com.lb.message.enums.CmdType;
import com.lb.message.enums.ModuleType;
import com.lb.message.vo.ReconnectionInfo;
import com.lb.message.vo.hall.OnlineListResponse;
import com.lb.message.vo.room.RoomVO;
import com.lb.service.imp.GameService;
import com.lb.service.imp.HallService;
import com.lb.service.imp.RoomService;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.ChannelHandler.Sharable;
import io.netty.handler.codec.http.websocketx.*;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler.HandshakeComplete;
import io.netty.handler.timeout.IdleState;
import io.netty.handler.timeout.IdleStateEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Netty WebSocket服务器处理器
 * 处理WebSocket连接的建立、关闭和消息传递
 *
 * @author LiarBar
 * @version 1.0
 */
@Slf4j
@Component
@Sharable
public class NettyWebSocketServerHandler extends SimpleChannelInboundHandler<WebSocketFrame> {

    // 静态变量，用于在处理器中访问Spring管理的Bean
    private  UserMapper userMapper;
    private  ConnectionManager connectionManager;
    private  RoomService roomService;
    private  GameService gameService;
    private  GameManager gameManager;
    private  RoomManager roomManager;
    private  Dispatcher dispatcher;
    private  final ObjectMapper objectMapper = new ObjectMapper();

    // 延迟任务执行器
    private static final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);


    @Autowired
    public void setUserMapper(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Autowired
    public void setConnectionManager(ConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    @Autowired
    public void setRoomService(RoomService roomService) {
        this.roomService = roomService;
    }

    @Autowired
    public void setGameService(GameService gameService) {
        this.gameService = gameService;
    }

    @Autowired
    public void setGameManager(GameManager gameManager) {
        this.gameManager = gameManager;
    }

    @Autowired
    public void setRoomManager(RoomManager roomManager) {
        this.roomManager = roomManager;
    }

    @Autowired
    public void setDispatcher(Dispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }


    /**
     * 通道非激活时调用 - 连接关闭
     */
    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        String channelId = ctx.channel().id().asShortText();
        Long userId = ctx.channel().attr(HandshakeAuthHandler.USER_ID_ATTR).get();
        ConnectionContext connectionContext = connectionManager.getConnection(ctx.channel().id().asShortText());

        log.info("WebSocket连接关闭: channelId={}, userId={}", channelId, userId);

        // 执行初步断联逻辑
        handleTemporaryDisconnection(channelId, userId);

        // 安排延迟任务，30秒后检查用户状态
        scheduleDelayedDisconnectionCheck(channelId, userId, connectionContext);

        super.channelInactive(ctx);
    }

    /**
     * 读取消息
     */
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, WebSocketFrame frame) throws Exception {
        String channelId = ctx.channel().id().asShortText();
        Long userId = ctx.channel().attr(HandshakeAuthHandler.USER_ID_ATTR).get();

        // 处理不同类型的WebSocket帧
        if (frame instanceof TextWebSocketFrame) {
            handleTextMessage(ctx, (TextWebSocketFrame) frame, userId);
        } else if (frame instanceof PongWebSocketFrame) {
            handlePongFrame(ctx, (PongWebSocketFrame) frame);
        } else if (frame instanceof CloseWebSocketFrame) {
            handleCloseFrame(ctx, (CloseWebSocketFrame) frame);
        }
        else {
            log.warn("不支持的WebSocket帧类型: {}, channelId={}", frame.getClass().getSimpleName(), channelId);
            ctx.close();
        }
    }

    /**
     * 异常处理
     */
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        String channelId = ctx.channel().id().asShortText();
        Long userId = ctx.channel().attr(HandshakeAuthHandler.USER_ID_ATTR).get();

        log.error("WebSocket连接发生异常: channelId={}, userId={}, error={}",
                 channelId, userId, cause.getMessage(), cause);

        try {
            // 清理连接资源
            connectionManager.removeConnection(channelId);
            connectionManager.broadcastAllOnlineUsers();
        } catch (Exception e) {
            log.error("清理异常连接时发生异常: channelId={}, error={}", channelId, e.getMessage(), e);
        }

        ctx.close();
    }

    /**
     * 用户事件触发（如心跳检测、握手完成）
     */
    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
        if (evt instanceof HandshakeComplete) {
            // WebSocket握手完成，执行用户连接逻辑
            handleHandshakeComplete(ctx);
        } else if (evt instanceof IdleStateEvent event) {
            String channelId = ctx.channel().id().asShortText();
            Long userId = ctx.channel().attr(HandshakeAuthHandler.USER_ID_ATTR).get();

            if (event.state() == IdleState.READER_IDLE) {
                log.info("客户端读空闲超时，主动断开连接: channelId={}, userId={}", channelId, userId);

                // 获取ConnectionContext
                ConnectionContext connectionContext = connectionManager.getConnection(channelId);

                // 执行初步断联逻辑
                handleTemporaryDisconnection(channelId, userId);

                // 安排延迟任务，30秒后检查用户状态
                scheduleDelayedDisconnectionCheck(channelId, userId, connectionContext);

                // 关闭连接
                ctx.close();
            }
        } else {
            super.userEventTriggered(ctx, evt);
        }
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 处理WebSocket握手完成事件
     */
    private void handleHandshakeComplete(ChannelHandlerContext ctx) {
        String channelId = ctx.channel().id().asShortText();
        String remoteAddress = getRemoteAddress(ctx);
        log.info("WebSocket握手完成: channelId={}, remoteAddress={}", channelId, remoteAddress);

        // 从HandshakeAuthHandler设置的Channel属性中获取用户信息
        Long userId = ctx.channel().attr(HandshakeAuthHandler.USER_ID_ATTR).get();
        String username = ctx.channel().attr(HandshakeAuthHandler.USERNAME_ATTR).get();

        if (userId == null) {
            log.warn("无法获取用户ID，可能认证未通过: channelId={}", channelId);
            ctx.close();
            return;
        }

        // 验证用户有效性
        UserEntity user = validateUser(userId);
        if (user == null) {
            log.warn("无效的用户ID: userId={}, channelId={}", userId, channelId);
            sendErrorResponse(ctx, "无效的用户ID");
            ctx.close();
            return;
        }

        boolean isReconnect = connectionManager.getPlayerByUserId(userId) != null;
        // 创建或更新Player对象
        Player player = createOrUpdatePlayer(userId, user);
        if (player == null) {
            log.error("创建Player对象失败: userId={}, channelId={}", userId, channelId);
            sendErrorResponse(ctx, "创建玩家对象失败");
            ctx.close();
            return;
        }


        // 创建ConnectionContext并管理连接
        ConnectionContext connectionContext = new NettyConnectionContext(ctx.channel());
        connectionContext.setUserId(userId);
        connectionManager.addConnection(channelId, connectionContext, player);


        if(isReconnect) {
            handleReconnection(userId, connectionContext);
            return;
        }

        // 发送欢迎消息
        sendWelcomeMessage(connectionContext, user);

        // 广播在线用户列表
        connectionManager.broadcastAllOnlineUsers();

        log.info("WebSocket连接成功建立: userId={}, username={}, channelId={}", userId, username, channelId);
    }

    /**
     * 处理初步断联逻辑
     * 职责：断开连接状态，但保留用户的游戏和房间状态
     *
     * @param channelId 连接ID
     * @param userId 用户ID
     */
    private void handleTemporaryDisconnection(String channelId, Long userId) {
        try {
            // 移除连接状态
            Long disconnectedUserId = connectionManager.removeConnection(channelId);

            if (disconnectedUserId != null) {
                log.info("初步断联完成: userId={}, channelId={}, 状态保留", disconnectedUserId, channelId);
            }

            // 广播更新后的在线用户列表
            connectionManager.broadcastAllOnlineUsers();

        } catch (Exception e) {
            log.error("处理初步断联时发生异常: channelId={}, userId={}, error={}", channelId, userId, e.getMessage(), e);
        }
    }

    /**
     * 处理彻底断联逻辑
     * 职责：清理所有状态，包括游戏状态、房间状态等
     *
     * @param channelId 连接ID
     * @param userId 用户ID
     * @param connectionContext 连接上下文
     */
    private void handlePermanentDisconnection(String channelId, Long userId, ConnectionContext connectionContext) {
        try {
            if (userId != null) {
                // 检查玩家是否在游戏中
                if (gameManager.isPlayerInGame(userId)) {
                    try {
                        Long gameId = gameManager.getGameByPlayer(userId).getGameId();
                        LeaveGameRequest leaveGameRequest = new LeaveGameRequest();
                        leaveGameRequest.setGameId(gameId);

                        WebSocketMsg<LeaveGameRequest> leaveGameMsg = WebSocketMsg.response(
                            "disconnect",
                            ModuleType.GAME,
                            CmdType.LEAVE_GAME,
                            leaveGameRequest
                        );

                        gameService.leaveGame(leaveGameMsg, connectionContext);
                        log.info("玩家彻底断联，已离开游戏: userId={}, gameId={}", userId, gameId);
                    } catch (Exception e) {
                        log.error("处理玩家离开游戏时发生异常: userId={}, error={}", userId, e.getMessage(), e);
                    }
                }

                // 处理离开房间
                if (connectionContext != null) {
                    try {
                        roomService.leaveRoom(
                            WebSocketMsg.response("disconnect", ModuleType.ROOM, CmdType.ROOM_LEAVE, null),
                            connectionContext
                        );
                    } catch (Exception e) {
                        log.error("处理玩家离开房间时发生异常: userId={}, error={}", userId, e.getMessage(), e);
                    }
                }

                // 清理UserStateManager中的用户状态
                try {
                    Player removedPlayer = connectionManager.getPlayerByUserId(userId);
                    if (removedPlayer != null) {
                        log.info("已清理用户状态: userId={}, username={}", userId, removedPlayer.getUsername());
                    }
                } catch (Exception e) {
                    log.error("清理用户状态时发生异常: userId={}, error={}", userId, e.getMessage(), e);
                }

                log.info("彻底断联完成，所有状态已清理: userId={}", userId);
            }

            // 广播更新后的在线用户列表
            connectionManager.broadcastAllOnlineUsers();

        } catch (Exception e) {
            log.error("处理彻底断联时发生异常: channelId={}, userId={}, error={}", channelId, userId, e.getMessage(), e);
        }
    }

    /**
     * 处理文本消息
     */
    private void handleTextMessage(ChannelHandlerContext ctx, TextWebSocketFrame frame, Long userId) {
        String channelId = ctx.channel().id().asShortText();
        String messageContent = frame.text();
        log.debug("收到WebSocket消息: userId={}, channelId={}, message={}", userId, channelId, messageContent);

        try {
            // 解析消息
            WebSocketMsg<?> msg;
            try {
                msg = objectMapper.readValue(messageContent, WebSocketMsg.class);
            } catch (Exception parseException) {
                log.warn("收到无法解析的消息，可能是未实现的功能: userId={}, channelId={}, message={}",
                        userId, channelId, messageContent);
                return;
            }

            // 获取ConnectionContext
            ConnectionContext connectionContext = connectionManager.getConnection(ctx.channel().id().asShortText());
            if (connectionContext == null) {
                log.warn("无法找到ConnectionContext，可能连接已断开: channelId={}", channelId);
                sendErrorResponse(ctx, "连接状态异常，请重新连接");
                return;
            }

            // 通过Dispatcher处理消息
            WebSocketMsg<?> response = dispatcher.dispatch(msg, connectionContext);
            if (response != null) {
                sendWebSocketMessage(ctx, response);
            }

        } catch (Exception e) {
            log.error("处理WebSocket消息时发生异常: userId={}, channelId={}, error={}",
                     userId, channelId, e.getMessage(), e);
            sendErrorResponse(ctx, "消息处理异常: " + e.getMessage());
        }
    }


    /**
     * 处理Pong帧
     */
    private void handlePongFrame(ChannelHandlerContext ctx, PongWebSocketFrame frame) {
        log.debug("收到Pong帧: channelId={}", ctx.channel().id().asShortText());
    }

    /**
     * 处理关闭帧
     */
    private void handleCloseFrame(ChannelHandlerContext ctx, CloseWebSocketFrame frame) {
        String channelId = ctx.channel().id().asShortText();
        log.info("收到关闭帧: channelId={}, statusCode={}, reasonText={}",
                channelId, frame.statusCode(), frame.reasonText());

        // 响应关闭帧
        CloseWebSocketFrame closeFrame = new CloseWebSocketFrame(
            frame.statusCode(),
            frame.reasonText()
        );
        ctx.writeAndFlush(closeFrame).addListener(future -> ctx.close());
    }


    /**
     * 验证用户有效性
     */
    private UserEntity validateUser(Long userId) {
        if (userId == null) {
            return null;
        }

        try {
            return userMapper.selectById(userId);
        } catch (Exception e) {
            log.error("查询用户时发生异常: userId={}, error={}", userId, e.getMessage(), e);
            return null;
        }
    }

    /**
     * 创建或更新Player对象
     */
    private Player createOrUpdatePlayer(Long userId, UserEntity user) {
        try {
            Player player = connectionManager.getPlayerByUserId(userId);

            if (player == null) {
                // 首次连接
                player = new Player();
                player.setUserId(userId);
                player.setUsername(user.getUsername());
                player.setNickName(user.getName());
                player.enterLobby();
                log.info("创建新的Player对象: userId={}, username={}", userId, user.getUsername());
            } else {
                // 断线重连
                log.info("断线重连: userId={}, username={}, 原状态={}, 房间ID={}",
                        userId, user.getUsername(), player.getStatusDescription(), player.getRoomId());

                player.setUsername(user.getUsername());
                player.setNickName(user.getName());
                player.setOnline();
            }

            return player;
        } catch (Exception e) {
            log.error("创建或更新Player对象时发生异常: userId={}, error={}", userId, e.getMessage(), e);
            return null;
        }
    }

    /**
     * 发送欢迎消息
     */
    private void sendWelcomeMessage(ConnectionContext connectionContext, UserEntity user) {
        Map<String, Object> welcomeMessage = new HashMap<>();
        welcomeMessage.put("type", "welcome");
        welcomeMessage.put("message", "欢迎连接到游戏服务器！");
        welcomeMessage.put("user", Map.of(
            "id", user.getId(),
            "email", user.getEmail(),
            "username", user.getUsername(),
            "timestamp", LocalDateTime.now().toString()
        ));

        connectionContext.sendJsonMessageAsync(welcomeMessage);
    }


    /**
     * 发送WebSocket消息
     */
    private void sendWebSocketMessage(ChannelHandlerContext ctx, Object message) {
        try {
            String messageJson = objectMapper.writeValueAsString(message);
            ctx.writeAndFlush(new TextWebSocketFrame(messageJson));
        } catch (IOException e) {
            log.error("发送WebSocket消息失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 发送错误消息
     */
    private void sendErrorResponse(ChannelHandlerContext ctx, String errorMessage) {
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("type", "error");
        errorResponse.put("message", errorMessage);
        errorResponse.put("timestamp", LocalDateTime.now().toString());

        sendWebSocketMessage(ctx, errorResponse);
    }

    /**
     * 获取远程地址
     */
    private String getRemoteAddress(ChannelHandlerContext ctx) {
        InetSocketAddress remoteAddress = (InetSocketAddress) ctx.channel().remoteAddress();
        return remoteAddress != null ? remoteAddress.getAddress().getHostAddress() : "unknown";
    }

    /**
     * 安排延迟断开连接检查任务
     *
     * @param channelId 连接ID
     * @param userId 用户ID
     * @param connectionContext 连接上下文
     */
    private void scheduleDelayedDisconnectionCheck(String channelId, Long userId, ConnectionContext connectionContext) {
        if (userId == null) {
            log.warn("用户ID为空，无法安排延迟断开连接检查: channelId={}", channelId);
            return;
        }

        scheduler.schedule(() -> {
            try {
                // 检查UserStateManager中的userStates是否还存储该用户的Player对象且用户状态为在线
                Player player = connectionManager.getPlayerByUserId(userId);
                if (player.isOnline()) {
                    // 用户仍然在线，不需要执行清理操作
                    log.info("用户仍然在线，无需执行清理操作: userId={}", userId);
                } else {
                    // 用户不在线，执行彻底断联清理操作
                    log.info("用户已离线，执行彻底断联清理操作: userId={}", userId);
                    handlePermanentDisconnection(channelId, userId, connectionContext);
                }
            } catch (Exception e) {
                log.error("执行延迟断开连接检查时发生异常: userId={}, error={}", userId, e.getMessage(), e);
            }
        }, 30, TimeUnit.SECONDS);
    }

    /**
     * 处理重连逻辑
     * @param userId 用户ID
     * @param connectionContext 连接上下文
     */
    private void handleReconnection(Long userId, ConnectionContext connectionContext) {
        try {
            // 创建重连信息对象
            ReconnectionInfo reconnectionInfo = new ReconnectionInfo();

            // 1. 填充大厅信息 - 所有重连用户都需要
            java.util.List<Player> onlinePlayers = connectionManager.getAllOnlinePlayers();
            OnlineListResponse onlineListResponse = new OnlineListResponse();
            onlineListResponse.setOnlineCount(onlinePlayers.size());
            onlineListResponse.setOnlineUsers(onlinePlayers.stream()
                .filter(p -> p.getUsername() != null && !p.getUsername().trim().isEmpty())
                .map(player1 -> {
                    OnlineListResponse.OnlineUserVO userInfo = new OnlineListResponse.OnlineUserVO();
                    userInfo.setUserId(player1.getUserId());
                    userInfo.setUsername(player1.getUsername());
                    userInfo.setStatus(player1.getStatusDescription());
                    userInfo.setLocation(player1.getLocationDescription());
                    userInfo.setNickName(player1.getNickName());
                    return userInfo;
                })
                .collect(java.util.stream.Collectors.toList()));
            reconnectionInfo.setOnlineListResponse(onlineListResponse);

            // 2. 检查玩家是否在房间中
            Room playerRoom = roomManager.getPlayerRoom(userId);
            boolean inRoom = playerRoom != null;
            boolean inGame = false;

            if (inRoom) {
                // 通过RoomVO获取房间信息
                RoomVO roomVO = playerRoom.toRoomVO();
                reconnectionInfo.setRoomId(roomVO.getRoomId());
                reconnectionInfo.setRoomName(roomVO.getRoomName());
                reconnectionInfo.setOwnerId(roomVO.getOwnerId());
                reconnectionInfo.setRoomStatus(roomVO.getRoomStatus());
                reconnectionInfo.setGameModeName(roomVO.getGameModeName());
                reconnectionInfo.setCurrentPlayerCount(roomVO.getCurrentPlayerCount());
                reconnectionInfo.setMaxPlayers(roomVO.getMaxPlayers());
                reconnectionInfo.setAvailableSlots(roomVO.getAvailableSlots());
                reconnectionInfo.setIsPrivate(roomVO.getIsPrivate());
                reconnectionInfo.setDescription(roomVO.getDescription());
                reconnectionInfo.setPlayers(roomVO.getPlayers());

                // 3. 检查玩家是否在游戏中
                Game playerGame = gameManager.getGameByPlayer(userId);
                inGame = playerGame != null;

                if (inGame) {
                    // 填充游戏信息
                    reconnectionInfo.setGameId(playerGame.getGameId());

                    // 获取当前玩家的GamePlayer对象
                    GamePlayer currentPlayerGamePlayer = playerGame.getPlayers().stream()
                        .filter(gp -> gp.getPlayerId() == userId)
                        .findFirst()
                        .orElse(null);
                    reconnectionInfo.setGamePlayers(currentPlayerGamePlayer);

                    reconnectionInfo.setFirstPlayerId(playerGame.getCurrentRound().getCurrentPlayer().getPlayerId());
                    reconnectionInfo.setTargetCardType(playerGame.getCurrentRound().getTargetCardType());
                    reconnectionInfo.setRoundNumber(playerGame.getCurrentRound().getRoundNumber());
                    reconnectionInfo.setPlayerIds(playerGame.getPlayers().stream()
                        .map(GamePlayer::getPlayerId)
                        .collect(java.util.stream.Collectors.toList()));

                    // 填充所有玩家手牌数量（按座位顺序）
                    reconnectionInfo.setHandCards(playerGame.getPlayers().stream()
                        .map(gp -> (long) gp.getHandCards().size())
                        .collect(java.util.stream.Collectors.toList()));

                    // 填充所有玩家子弹数量（按座位顺序）
                    reconnectionInfo.setBulletCounts(playerGame.getPlayers().stream()
                        .map(GamePlayer::getBulletCount)
                        .collect(java.util.stream.Collectors.toList()));
                }
            }

            // 发送重连信息给用户
            WebSocketMsg<ReconnectionInfo> reconnectionMsg = WebSocketMsg.push(
                ModuleType.SYSTEM,
                CmdType.RECONNECT,
                reconnectionInfo
            );
            connectionContext.sendJsonMessage(reconnectionMsg);

            log.info("发送重连信息完成: userId={}, 在房间={}, 在游戏={}",
                userId, inRoom, inGame);

        } catch (Exception e) {
            log.error("处理重连逻辑时发生异常: userId={}, error={}", userId, e.getMessage(), e);
        }
    }
}