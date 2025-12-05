import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import message from '../components/common/Message';
import Background from '../components/common/BackGround/Background';
import DebouncedButton from '../components/common/DebouncedButton';
import { useUserInfo } from '../hooks/useUserInfo';
import { useCurrentRoom, useRoomStore } from '../store/roomStore';
import { useRoomActions } from '../hooks/useRoomActions';
import { useRoomState } from '../hooks/useRoomState';
import { useWebRTC } from '../hooks/useWebRTC';
import type { PlayerVO } from '../utils/createRoom';
import { leaveRoom } from '../utils/leaveRoom';
import { playerPrepare, playerCancelPrepare } from '../utils/gameReady';
import { startGame } from '../utils/GameLogic/gameStart';
import { registerNewRoundHandler } from '../utils/GameLogic/gameRound';
import { registerGameFinishedHandler } from '../utils/GameLogic/gameFinished';
import { registerGameLeaveHandler } from '../utils/GameLogic/playerLeave';
import { useWebSocketStore } from '../store/websocketStore';
import useAuthStore from '../store/authStore';
import { useGameStore, useGameActions } from '../store/gameStore';
import { MessageModule, GameCommand, type PlayerSeatsData, type GameStartedData } from '../types/websocketMessages';
import './GameBarRoom.less';

/**
 * 游戏酒吧房间组件
 * 负责显示房间内的玩家列表、房间设置和语音聊天功能
 * 支持玩家准备、房主开始游戏等核心功能
 */
export default function GameBarRoom() {
    // 获取路由参数
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();

    // 获取用户信息和认证状态
    const { userInfo } = useUserInfo();

    // 获取房间相关状态和操作
    const { currentRoom } = useCurrentRoom();
    const { updatePlayer } = useRoomStore();
    const { leaveRoom: leaveRoomAction } = useRoomActions();

    // 获取游戏相关状态和操作
    const { isGameStarted, playerSeats, gameId } = useGameStore();
    const { 
        setGameId, 
        setPlayerSeats, 
        setGameStarted, 
        getMySeatIndex, 
        clearGame,
        setMyGamePlayer,
        setCurrentTurnPlayerId,
        setTargetCardType,
        setRoundNumber,
        initializePlayersCardCounts,
        initializePlayersAlive,
        initializePlayersBullets
    } = useGameActions();

    // UI状态管理
    const [loading, setLoading] = useState(true); // 页面加载状态
    const [isLeavingRoom, setIsLeavingRoom] = useState(false); // 用户是否正在主动退出房间
    const [isMuted, setIsMuted] = useState(false); // 麦克风静音状态
    // 初始语音关闭，避免进入房间立即获取麦克风与信令竞争
    const [isAudioEnabled, setIsAudioEnabled] = useState(false); // 语音功能是否启用
    const [isStartingGame, setIsStartingGame] = useState(false); // 是否正在请求开始游戏
    const [isVoiceCollapsed, setIsVoiceCollapsed] = useState(false); // 语音面板是否收起

    // 从用户信息中获取当前用户ID，兼容不同命名方式
    const currentUserId = userInfo ? (userInfo.userId ?? userInfo.id)?.toString() ?? null : null;

    // 调试输出座位布局
    useEffect(() => {
        if (playerSeats.length > 0) {
            console.log('玩家座位布局:', playerSeats);
            if (currentUserId) {
                const seatIndex = getMySeatIndex(parseInt(currentUserId));
                console.log('我的座位号:', seatIndex);
            }
        }
    }, [playerSeats, currentUserId, getMySeatIndex]);

    /**
     * 语音事件回调处理函数
     * 使用 useCallback 缓存函数引用，避免不必要的重渲染
     */

    // 用户加入语音时的回调
    const handleUserJoined = useCallback((userId: string) => {
        console.log('用户加入语音:', userId);
        message.success(`${userId} 加入了语音聊天`);
    }, []);

    // 用户离开语音时的回调
    const handleUserLeft = useCallback((userId: string) => {
        console.log('用户离开语音:', userId);
        message.info(`${userId} 离开了语音聊天`);
    }, []);

    // 与用户建立语音连接时的回调
    const handlePeerConnected = useCallback((userId: string) => {
        console.log('与用户建立语音连接:', userId);
        message.success(`已与 ${userId} 建立语音连接`);
    }, []);

    // 与用户断开语音连接时的回调
    const handlePeerDisconnected = useCallback((userId: string) => {
        console.log('与用户断开语音连接:', userId);
        message.info(`与 ${userId} 的语音连接已断开`);
    }, []);

    /**
     * WebRTC 相关状态和函数
     * 通过自定义Hook获取WebRTC功能的核心状态和方法
     */
    const {
        isInitialized: isWebRTCInitialized, // WebRTC是否已初始化
        localStream, // 本地媒体流
        peers, // 对等连接列表
        error: webRTCError, // WebRTC错误信息
        initialize, // 初始化WebRTC
        connectToUser, // 连接到指定用户
        disconnectFromUser, // 断开与指定用户的连接
        cleanup // 清理WebRTC资源
    } = useWebRTC(
        handleUserJoined,
        handleUserLeft,
        handlePeerConnected,
        handlePeerDisconnected
    );

    // 监听房间状态变化（来自自定义Hook）
    useRoomState();

    // 注册游戏开始通知处理器（GAME:GAME_STARTED）
    // 必须在 GameBarRoom 中提前注册，因为消息可能在跳转到 GameStage2D 之前到达
    useEffect(() => {
        const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
        console.log('在 GameBarRoom 中注册 GAME_STARTED 处理器');
        registerHandler({
            module: MessageModule.GAME,
            cmd: GameCommand.GAME_STARTED,
            handler: (wsMessage) => {
                console.log('在 GameBarRoom 中收到 GAME_STARTED 消息:', wsMessage);
                const data = wsMessage.data as GameStartedData;
                if (data && data.gameId && data.gamePlayers) {
                    console.log('解析后的游戏数据:', data);
                    console.log('玩家手牌:', data.gamePlayers.handCards);
                    // 更新游戏状态
                    setMyGamePlayer(data.gamePlayers);
                    setCurrentTurnPlayerId(data.firstPlayerId);
                    setTargetCardType(data.targetCardType);
                    setRoundNumber(data.roundNumber);
                    
                    // 初始化所有玩家手牌数量为5
                    const { playerSeats } = useGameStore.getState();
                    if (playerSeats && playerSeats.length > 0) {
                        initializePlayersCardCounts(playerSeats, 5);
                        initializePlayersAlive(playerSeats);
                        initializePlayersBullets(playerSeats, 6);
                        console.log('已初始化所有玩家手牌数量为5');
                    }

                    message.success(`游戏开始！目标牌: ${data.targetCardType}, 轮次: ${data.roundNumber}`);
                    console.log('游戏状态已更新到 gameStore');
                } else {
                    console.warn('GAME_STARTED 数据不完整:', data);
                }
            },
            description: '处理游戏开始通知（包含玩家手牌）'
        });
        return () => {
            console.log('在 GameBarRoom 中注销 GAME_STARTED 处理器');
            unregisterHandler(MessageModule.GAME, GameCommand.GAME_STARTED);
        };
    }, [setMyGamePlayer, setCurrentTurnPlayerId, setTargetCardType, setRoundNumber, initializePlayersCardCounts, initializePlayersAlive, initializePlayersBullets]);

    // 注册游戏座位布局广播处理器（GAME:PLAYER_SEATS）
    useEffect(() => {
        const { registerHandler, unregisterHandler } = useWebSocketStore.getState();
        registerHandler({
            module: MessageModule.GAME,
            cmd: GameCommand.PLAYER_SEATS,
            handler: (wsMessage) => {
                const data = wsMessage.data as PlayerSeatsData;
                if (data && Array.isArray(data.playerIds)) {
                    // 更新 gameStore
                    setGameId(data.gameId);
                    setPlayerSeats(data.playerIds);
                    
                    // 初始化所有玩家手牌数量为5
                    initializePlayersCardCounts(data.playerIds, 5);
                    initializePlayersAlive(data.playerIds);
                    initializePlayersBullets(data.playerIds, 6);
                    
                    if (!isGameStarted) {
                        setGameStarted(true); // 控制页面切换至游戏视图
                        message.success('收到座位布局，进入游戏');
                        if (roomId) {
                            navigate(`/room/${roomId}/Gaming`);
                        }
                    }
                }
            },
            description: '处理游戏开始时的玩家座位布局广播'
        });
        return () => {
            unregisterHandler(MessageModule.GAME, GameCommand.PLAYER_SEATS);
        };
    }, [navigate, roomId, isGameStarted, setGameId, setPlayerSeats, setGameStarted, initializePlayersCardCounts, initializePlayersAlive, initializePlayersBullets]);

    /**
     * WebRTC 初始化逻辑
     * 仅在用户明确开启语音后才初始化，避免不必要的资源消耗
     */
    const isWebRTCInitializing = useRef(false); // 避免重复初始化的标志
    useEffect(() => {
        // 仅在用户开启语音后才初始化 WebRTC
        if (isAudioEnabled && roomId && currentRoom && !isWebRTCInitialized && !isWebRTCInitializing.current) {
            isWebRTCInitializing.current = true;
            initialize(parseInt(roomId))
                .then(success => {
                    if (success) {
                        message.success('语音功能已初始化');
                    } else {
                        message.error('语音功能初始化失败');
                    }
                })
                .catch(error => {
                    console.error('WebRTC 初始化错误:', error);
                    message.error('语音功能初始化失败');
                })
                .finally(() => {
                    isWebRTCInitializing.current = false;
                });
        }
    }, [isAudioEnabled, roomId, currentRoom, isWebRTCInitialized, initialize]);

    /**
     * 房间玩家变化时的语音连接管理
     * 自动连接新加入的玩家，断开已离开的玩家
     */
    useEffect(() => {
        if (!isAudioEnabled || !isWebRTCInitialized || !currentRoom || !currentUserId) return;
        const roomPlayers = currentRoom.players || [];
        const roomPlayerIds = roomPlayers.map(p => (p.playerId || 0).toString());

        // 获取当前已连接的用户ID
        const connectedPeerIds = peers.map(p => p.id);

        // 连接新加入的玩家（除了自己）
        roomPlayerIds.forEach(playerId => {
            if (playerId !== currentUserId && !connectedPeerIds.includes(playerId)) {
                connectToUser(playerId).catch(error => {
                    console.error(`连接用户 ${playerId} 失败:`, error);
                });
            }
        });

        // 断开已离开的玩家
        connectedPeerIds.forEach(peerId => {
            if (!roomPlayerIds.includes(peerId)) {
                disconnectFromUser(peerId);
            }
        });
    }, [currentRoom, currentUserId, isWebRTCInitialized, peers, connectToUser, disconnectFromUser, isAudioEnabled]);

    /**
     * 切换麦克风静音状态
     * 通过控制本地媒体流的音频轨道来实现
     */
    const toggleMute = useCallback(() => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                const newMutedState = !isMuted;
                audioTracks[0].enabled = !newMutedState;
                setIsMuted(newMutedState);
                message.success(newMutedState ? '麦克风已静音' : '麦克风已开启');
            }
        }
    }, [localStream, isMuted]);

    /**
     * 切换音频功能开关
     * 开启时初始化WebRTC并连接房间内所有玩家
     * 关闭时断开所有语音连接并完全清理资源
     */
    const toggleAudio = useCallback(() => {
        if (isAudioEnabled) {
            // 禁用音频，完全清理 WebRTC 资源（包括注销信令处理器）
            cleanup();
            setIsAudioEnabled(false);
            message.info('语音功能已关闭');
        } else {
            // 用户主动开启：若尚未初始化则先初始化再连接
            const doConnect = () => {
                if (currentRoom && currentUserId) {
                    const roomPlayers = currentRoom.players || [];
                    roomPlayers.forEach(player => {
                        const playerId = player.playerId || 0;
                        if (playerId.toString() !== currentUserId) {
                            connectToUser(playerId.toString()).catch(error => {
                                console.error(`连接用户 ${playerId} 失败:`, error);
                            });
                        }
                    });
                }
            };
            if (!isWebRTCInitialized && roomId && !isWebRTCInitializing.current) {
                isWebRTCInitializing.current = true;
                initialize(parseInt(roomId))
                    .then(success => {
                        if (success) {
                            doConnect();
                            message.success('语音功能已初始化并开启');
                        } else {
                            message.error('语音功能初始化失败');
                        }
                    })
                    .catch(err => {
                        console.error('语音初始化失败:', err);
                        message.error('语音功能初始化失败');
                    })
                    .finally(() => {
                        isWebRTCInitializing.current = false;
                    });
            } else {
                doConnect();
                message.success('语音功能已开启');
            }
            setIsAudioEnabled(true);
        }
    }, [isAudioEnabled, cleanup, currentRoom, currentUserId, connectToUser, isWebRTCInitialized, initialize, roomId]);

    /**
     * 组件卸载时清理 WebRTC 资源
     * 使用useRef确保始终获取最新的cleanup函数引用
     */
    const cleanupRef = useRef(cleanup);
    cleanupRef.current = cleanup;
    useEffect(() => {
        return () => {
            cleanupRef.current();
        };
    }, []);

    /**
     * 监听并显示 WebRTC 错误
     */
    useEffect(() => {
        if (webRTCError) {
            message.error(`WebRTC 错误: ${webRTCError}`);
        }
    }, [webRTCError]);

    /**
     * 动态计算当前用户是否为房主
     */
    // 确保比较的是字符串形式的用户ID，优先使用 currentRoom.ownerId，回退到 players 中的 isOwner 标记
    const isOwner = (() => {
        if (!currentRoom || !currentUserId) return false;
        const ownerId = currentRoom.ownerId ?? currentRoom.players?.find(p => p.isOwner)?.playerId ?? null;
        if (ownerId === null || ownerId === undefined) return false;
        return ownerId.toString() === currentUserId;
    })();

    /**
     * 房主自动准备逻辑
     * 当用户成为房主且未准备时，自动发送准备消息
     */
    const hasAutoPrepared = useRef(false);
    useEffect(() => {
        if (isOwner && currentRoom && currentUserId && !hasAutoPrepared.current) {
            const currentPlayer = currentRoom.players?.find(p => p.playerId === parseInt(currentUserId));
            if (currentPlayer && !currentPlayer.isPrepared) {
                // 本地乐观更新
                updatePlayer(parseInt(currentUserId), { isPrepared: true });
                // 发送准备消息
                playerPrepare().catch(err => {
                    // 回滚本地状态
                    updatePlayer(parseInt(currentUserId), { isPrepared: false });
                    console.error('房主自动准备失败:', err);
                });
                hasAutoPrepared.current = true;
            }
        }
    }, [isOwner, currentRoom, currentUserId, updatePlayer]);

    /**
     * 房间初始化和认证状态检查
     * 处理未认证、房间ID无效等异常情况
     * 支持页面刷新后等待重连同步恢复房间状态
     */
    const reconnectWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isWaitingReconnect, setIsWaitingReconnect] = useState(true); // 是否正在等待重连同步

    useEffect(() => {
        if (!roomId) {
            message.error('房间ID无效');
            navigate('/gamebar');
            return;
        }

        // 检查当前房间是否与URL中的房间ID匹配
        if (currentRoom && currentRoom.roomId === parseInt(roomId)) {
            // 如果当前房间数据已存在且ID匹配，直接使用
            setLoading(false);
            setIsWaitingReconnect(false);
            return;
        }

        // 如果用户正在主动退出房间，不等待重连
        if (isLeavingRoom) {
            setLoading(false);
            setIsWaitingReconnect(false);
            return;
        }

        // 没有房间数据，可能是页面刷新，等待重连同步
        // 设置超时，如果超时后仍无数据则跳转回大厅
        if (isWaitingReconnect && !reconnectWaitTimer.current) {
            console.log('[GameBarRoom] 等待重连同步恢复房间状态...');
            reconnectWaitTimer.current = setTimeout(() => {
                // 超时后检查是否已有房间数据
                const { currentRoom: latestRoom } = useRoomStore.getState();
                if (!latestRoom || latestRoom.roomId !== parseInt(roomId)) {
                    console.log('[GameBarRoom] 重连超时，未能恢复房间状态，跳转回大厅');
                    message.warning('未能恢复房间状态，请重新加入房间');
                    navigate('/gamebar');
                }
                setIsWaitingReconnect(false);
                setLoading(false);
                reconnectWaitTimer.current = null;
            }, 5000); // 等待5秒重连同步
        }

        return () => {
            if (reconnectWaitTimer.current) {
                clearTimeout(reconnectWaitTimer.current);
                reconnectWaitTimer.current = null;
            }
        };
    }, [roomId, navigate, currentRoom, isLeavingRoom, isWaitingReconnect]);

    /**
     * 重连后游戏状态恢复处理
     * 如果重连同步恢复了游戏状态（gameId 不为空且 isGameStarted），自动跳转到游戏页面
     */
    useEffect(() => {
        if (gameId && isGameStarted && roomId && !isWaitingReconnect) {
            console.log('[GameBarRoom] 检测到游戏状态已恢复，跳转到游戏页面');
            navigate(`/room/${roomId}/Gaming`);
        }
    }, [gameId, isGameStarted, roomId, navigate, isWaitingReconnect]);

    /**
     * 处理退出房间逻辑
     * 设置离开标志，调用退出房间API，清理本地状态并跳转回大厅
     */
    const handleLeaveRoom = async () => {
        // 设置标志，表示用户正在主动退出房间
        setIsLeavingRoom(true);

        try {
            if (roomId) {
                await leaveRoom(parseInt(roomId));
                message.success('已退出房间');
            }
            leaveRoomAction();
            clearGame(); // 清空游戏状态
            navigate('/gamebar');
        } catch (error) {
            console.error('退出房间失败:', error);
            message.error(error instanceof Error ? error.message : '退出房间失败');
            // 即使WebSocket请求失败，也允许用户离开页面
            leaveRoomAction();
            clearGame(); // 清空游戏状态
            navigate('/gamebar');
        } finally {
            // 重置标志，以防组件没有被卸载的情况
            setIsLeavingRoom(false);
        }
    };

    /**
     * 处理玩家准备状态切换
     * 更新当前玩家的准备状态
     */
    const handleTogglePrepare = async () => {
        if (currentRoom && currentUserId) {
            const currentPlayer = currentRoom.players?.find(p => p.playerId === parseInt(currentUserId));
            if (currentPlayer) {
                const originalState = currentPlayer.isPrepared;
                const newPreparedState = !originalState;
                // 本地乐观更新
                updatePlayer(parseInt(currentUserId), { isPrepared: newPreparedState });
                message.success(newPreparedState ? '已准备' : '取消准备');
                try {
                    if (newPreparedState) {
                        await playerPrepare();
                    } else {
                        await playerCancelPrepare();
                    }
                } catch (err: any) {
                    // 回滚本地状态
                    updatePlayer(parseInt(currentUserId), { isPrepared: originalState });
                    message.error(err?.message || (newPreparedState ? '准备失败' : '取消准备失败'));
                }
            }
        }
    };

    /**
     * 处理开始游戏逻辑（房主专属功能）
     * 检查玩家数量和准备状态，满足条件时开始游戏
     */
    const handleStartGame = async () => {
        if (!roomId) {
            message.error('房间ID无效');
            return;
        }

        if (!currentRoom || !currentRoom.players) {
            message.error('房间信息缺失');
            return;
        }

        if (!isOwner) {
            message.error('只有房主可以开始游戏');
            return;
        }

        if (currentRoom.players.length < 2) {
            message.warning('玩家数量不足');
            return;
        }

        const allPrepared = currentRoom.players.every(player => player.isOwner || player.isPrepared);
        if (!allPrepared) {
            message.warning('还有玩家未准备');
            return;
        }

        const roomIdNumber = parseInt(roomId, 10);
        if (Number.isNaN(roomIdNumber)) {
            message.error('房间ID无效');
            return;
        }

        setIsStartingGame(true);
        try {
            await startGame(roomIdNumber);
            message.success('开始游戏指令已发送，等待座位布局广播...');
        } catch (error) {
            console.error('开始游戏失败:', error);
            const errorMessage = error instanceof Error ? error.message : '开始游戏失败';
            message.error(errorMessage);
        } finally {
            setIsStartingGame(false);
        }
    };

    /**
     * 注册新一轮开始通知处理器 (GAME:NEW_ROUND)
     */
    useEffect(() => {
        const unregister = registerNewRoundHandler((data) => {
            console.log('收到新一轮通知:', data);
            // 更新游戏状态
            setMyGamePlayer(data.gamePlayers);
            setCurrentTurnPlayerId(data.firstPlayerId);
            setTargetCardType(data.targetCardType);
            setRoundNumber(data.roundNumber);
            
            // 重置所有存活玩家手牌数量为5
            const { playerSeats, playersAlive } = useGameStore.getState();
            const alivePlayerIds = playerSeats.filter(id => playersAlive[id]);
            initializePlayersCardCounts(alivePlayerIds, 5);
            
            message.success(`第 ${data.roundNumber} 轮开始！目标牌: ${data.targetCardType}`);
        });
        return unregister;
    }, [setMyGamePlayer, setCurrentTurnPlayerId, setTargetCardType, setRoundNumber, initializePlayersCardCounts]);

    // 注册游戏结束通知处理器 (GAME:GAME_FINISHED)
    useEffect(() => {
        const unregister = registerGameFinishedHandler((data) => {
            console.log('收到游戏结束通知:', data);
            const winnerId = data.playerId;
            const winnerName = currentRoom?.players?.find(p => p.playerId === winnerId)?.nickname || (winnerId ? `玩家${winnerId}` : '无');
            
            message.info(`游戏结束！获胜者: ${winnerName}, 总轮数: ${data.totalRounds}`);
            
            // 延迟退出游戏视图，让玩家看到结果
            setTimeout(() => {
                setGameStarted(false);
                clearGame();
                if (roomId) {
                    navigate(`/room/${roomId}`);
                }
            }, 3000);
        });
        return unregister;
    }, [setGameStarted, clearGame, navigate, roomId, currentRoom]);

    // 注册玩家离开游戏通知处理器 (GAME:GAME_LEAVE)
    useEffect(() => {
        console.log('注册 GAME_LEAVE 处理器');
        const unregister = registerGameLeaveHandler((data) => {
            // 直接从 store 获取最新用户信息，避免闭包问题
            const user = useAuthStore.getState().user;
            const currentId = user ? (user.userId ?? user.id)?.toString() : null;

            console.log('收到 GAME_LEAVE 消息:', data);
            console.log('判断条件:', {
                storeUserId: currentId,
                leavePlayerId: data.leavePlayerId,
                isMatch: currentId && data.leavePlayerId.toString() === currentId
            });

            // 如果是自己离开了游戏，跳转回房间
            if (currentId && data.leavePlayerId.toString() === currentId) {
                console.log('执行退出游戏逻辑...');
                message.success('您已离开游戏');
                setGameStarted(false);
                clearGame();
                if (roomId) {
                    console.log('跳转回房间:', `/room/${roomId}`);
                    navigate(`/room/${roomId}`);
                }
            }
        });
        return () => {
            console.log('注销 GAME_LEAVE 处理器');
            unregister();
        };
    }, [roomId, navigate, setGameStarted, clearGame]);

    /**
     * 获取用户的语音连接状态
     * 对于自己：当用户已开启语音、WebRTC 已初始化并且存在本地流时视为已连接
     * 对于其他玩家：检查是否存在对应的peer连接且连接状态为已连接
     */
    const getUserVoiceStatus = useCallback((playerId: number) => {
        const playerIdStr = (playerId || 0).toString();
        if (playerIdStr === currentUserId) {
            return !!(isAudioEnabled && isWebRTCInitialized && localStream);
        }
        // 检查peer是否存在且连接状态为 'connected'
        const peer = peers.find(p => p.id === playerIdStr);
        return peer ? peer.pc.connectionState === 'connected' : false;
    }, [peers, isAudioEnabled, isWebRTCInitialized, localStream, currentUserId]);

    const connectedPeersCount = useMemo(() => {
        return peers.filter(peer => peer.pc.connectionState === 'connected').length;
    }, [peers]);

    const hasConnectedPeers = connectedPeersCount > 0;
    const initPending = isWebRTCInitializing.current;

    const voiceStatus = useMemo(() => {
        if (!isAudioEnabled) return 'off';
        if (initPending || !isWebRTCInitialized) return 'initializing';
        if (hasConnectedPeers) return 'connected';
        return 'waiting';
    }, [isAudioEnabled, isWebRTCInitialized, hasConnectedPeers, initPending]);

    const voiceStatusLabel = useMemo(() => {
        switch (voiceStatus) {
            case 'connected':
                return '语音已连接';
            case 'initializing':
                return '初始化中';
            case 'waiting':
                return '等待连接';
            default:
                return '语音未开启';
        }
    }, [voiceStatus]);

    /**
     * 加载状态渲染
     */
    if (loading) {
        return (
            <>
                <Background />
                <div className="loading-container">
                    <div className="loading-text">加载房间信息中...</div>
                </div>
            </>
        );
    }

    /**
     * 房间不存在或已被解散时的错误状态渲染
     */
    if (!currentRoom) {
        return (
            <>
                <Background />
                <div className="error-container">
                    <div className="error-text">房间不存在或已被解散</div>
                    <button className="back-btn" onClick={() => navigate('/gamebar')}>
                        返回大厅
                    </button>
                </div>
            </>
        );
    }

    /**
     * 主UI渲染
     * 包含房间头部信息、玩家列表和房间设置等主要功能区域
     */
    return (
        <>
            {/* 游戏开始后只渲染游戏内容 */}
            {isGameStarted ? (
                <Outlet />
            ) : (
                <div className="room-container">
                    <Background />
                    {/* 房间头部信息 */}
                    <div className="room-header">
                        <div className="room-info">
                            <h2 className="room-name">{currentRoom.roomName}</h2>
                            <div className="room-details">
                                <span>房间ID: {currentRoom.roomId}</span>
                                <span>模式: {currentRoom.gameModeName}</span>
                                <span>状态: {currentRoom.roomStatus}</span>
                            </div>
                        </div>
                        <button className="leave-room-btn" onClick={handleLeaveRoom}>
                            退出房间
                        </button>
                    </div>

                    {/* 房间主体内容 */}
                    <div className="room-content">
                        {/* 左侧玩家列表 */}
                        <div className="players-section">
                            <h3>玩家列表 ({currentRoom.currentPlayerCount}/{currentRoom.maxPlayers})</h3>
                            <div className="players-list">
                                {currentRoom.players?.map((player: PlayerVO) => {
                                    const isCurrentUser = player.playerId === parseInt(currentUserId || '0');
                                    const isConnected = getUserVoiceStatus(player.playerId || 0);

                                    return (
                                        <div className={`player-item ${player.isOwner ? 'owner' : ''}`} key={player.playerId}>
                                            <div className="player-avatar">
                                                <img src={player.avatar || 'https://picsum.photos/100/100'} alt="头像" />
                                                {/* 语音连接状态指示器 */}
                                                {isWebRTCInitialized && (
                                                    <div className={`voice-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                                                        {isConnected ? (
                                                            <span className="voice-icon">🎤</span>
                                                        ) : (
                                                            <span className="voice-icon">🔇</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="player-info">
                                                <div className="player-name">
                                                    {player.nickname}
                                                    {player.isOwner && <span className="owner-badge">房主</span>}
                                                    {isCurrentUser && <span className="you-badge">你</span>}
                                                </div>
                                                <div className="player-status">
                                                    {player.status}
                                                    {player.isPrepared && <span className="prepared-badge">已准备</span>}
                                                    {isWebRTCInitialized && (
                                                        <span className={`voice-status ${isConnected ? 'connected' : 'disconnected'}`}>
                                                            {isConnected ? '语音已连接' : '语音未连接'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* 空位显示 */}
                                {Array.from({ length: currentRoom.availableSlots || 0 }).map((_, index) => (
                                    <div className="empty-slot" key={`empty-${index}`}>
                                        <div className="empty-avatar">?</div>
                                        <div className="empty-text">等待玩家加入...</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 右侧房间设置和操作 */}
                        <div className="room-settings">
                            <h3>房间设置</h3>
                            <div className="settings-info">
                                <div className="setting-item">
                                    <span>房间名称:</span>
                                    <span>{currentRoom.roomName}</span>
                                </div>
                                <div className="setting-item">
                                    <span>游戏模式:</span>
                                    <span>{currentRoom.gameModeName}</span>
                                </div>
                                <div className="setting-item">
                                    <span>最大玩家数:</span>
                                    <span>{currentRoom.maxPlayers}</span>
                                </div>
                                <div className="setting-item">
                                    <span>房间类型:</span>
                                    <span>{currentRoom.isPrivate ? '私密房间' : '公开房间'}</span>
                                </div>
                                {currentRoom.description && (
                                    <div className="setting-item">
                                        <span>房间描述:</span>
                                        <span>{currentRoom.description}</span>
                                    </div>
                                )}
                            </div>


                            {/* 操作按钮 */}
                            <div className="room-actions">
                                {isOwner && (
                                    <DebouncedButton
                                        className="start-game-btn"
                                        onClick={handleStartGame}
                                        disabled={isStartingGame || (currentRoom.currentPlayerCount || 0) < 2}
                                        debounceDelay={1000}
                                    >
                                        {isStartingGame ? '开始中...' : '开始游戏'}
                                    </DebouncedButton>
                                )}
                                <DebouncedButton
                                    className={`prepare-btn ${currentRoom.players?.find(p => p.playerId === parseInt(currentUserId || '0'))?.isPrepared ? 'prepared' : ''}`}
                                    onClick={handleTogglePrepare}
                                    debounceDelay={500}
                                >
                                    {currentRoom.players?.find(p => p.playerId === parseInt(currentUserId || '0'))?.isPrepared ? '取消准备' : '准备'}
                                </DebouncedButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* 语音控制区域 - 侧边栏模式 */}
            <div className={`voice-controls-sidebar ${isVoiceCollapsed ? 'collapsed' : ''}`}>
                <div className="voice-panel-content">
                    <div className="voice-status-compact">
                        <div className={`status-dot status-${voiceStatus}`} />
                        <span className={`status-text status-${voiceStatus}`}>
                            {voiceStatusLabel}
                            {hasConnectedPeers && <span className="peer-count">({connectedPeersCount})</span>}
                        </span>
                    </div>
                    
                    <div className="voice-actions-compact">
                        <DebouncedButton
                            className={`voice-icon-btn ${isAudioEnabled ? 'active' : ''}`}
                            onClick={toggleAudio}
                            disabled={isWebRTCInitializing.current}
                            debounceDelay={800}
                            title={isAudioEnabled ? '关闭语音' : '开启语音'}
                        >
                            {isWebRTCInitializing.current ? '...' : (isAudioEnabled ? '📞' : '☎️')}
                        </DebouncedButton>
                        
                        <DebouncedButton
                            className={`voice-icon-btn ${isMuted ? 'muted' : ''}`}
                            onClick={toggleMute}
                            disabled={!isWebRTCInitialized || !isAudioEnabled}
                            debounceDelay={300}
                            title={isMuted ? '取消静音' : '静音'}
                        >
                            {isMuted ? '🔇' : '🎤'}
                        </DebouncedButton>
                    </div>
                </div>
                
                <button 
                    className="voice-collapse-toggle"
                    onClick={() => setIsVoiceCollapsed(!isVoiceCollapsed)}
                    title={isVoiceCollapsed ? "展开语音控制" : "收起"}
                >
                    {isVoiceCollapsed ? '🎤' : '◀'}
                </button>
            </div>
        </>
    );
}