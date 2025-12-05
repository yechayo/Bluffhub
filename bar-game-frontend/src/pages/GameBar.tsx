import Background from "../components/common/BackGround/Background";
import LoadingAnimation from "../components/common/LoadingFrame/LoadingAnimation";
import LogoutButton from "../components/common/LogoutButton/LogoutButton";
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import { useRoomList } from '../hooks/useRoomList';
import './GameBar.less';
import { useUserInfo } from '../hooks/useUserInfo';
import { useState } from "react";
import message from '../components/common/Message';
import { useNavigate } from "react-router-dom";
import { createRoom, type CreateRoomParams } from '../utils/createRoom';
import { joinRoom } from '../utils/joinRoom';

export default function GameBar() {
    const { onlineUsers, onlineCount, loading, error } = useOnlineUsers();
    const { roomList, loading: roomLoading, error: roomError, loadRoomList } = useRoomList();
    const { userInfo, loading: userLoading, error: userError } = useUserInfo();
    const navigate = useNavigate();
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [gameMode, setGameMode] = useState<'CLASSIC' | 'QUICK' | 'CUSTOM'>('CLASSIC');
    const [maxPlayers, setMaxPlayers] = useState(4);
    const [creatingRoom, setCreatingRoom] = useState(false);

    // 登录状态与跳转已由全局路由守卫统一处理

    const handleCreateRoom = async () => {
        if (!roomName.trim()) {
            message.error('请输入房间名称');
            return;
        }

        setCreatingRoom(true);
        try {
            const params: CreateRoomParams = {
                roomName: roomName.trim(),
                gameMode,
                maxPlayers
            };
            
            const response = await createRoom(params);
            message.success(`房间 "${response.roomName}" 创建成功！房间ID: ${response.roomId}`);
            
            // 重置表单
            setRoomName('');
            setGameMode('CLASSIC');
            setMaxPlayers(4);
            setShowCreateRoom(false);
            
            // 跳转到房间页面
            navigate(`/room/${response.roomId}`);
        } catch (error) {
            console.error('创建房间失败:', error);
            message.error(error instanceof Error ? error.message : '创建房间失败，请重试');
        } finally {
            setCreatingRoom(false);
        }
    };

    const handleJoinRoom = async (roomId: number, roomName: string) => {
        try {
            await joinRoom(roomId);
            message.success(`成功加入房间 "${roomName}"！`);
            
            // 跳转到房间页面
            navigate(`/room/${roomId}`);
        } catch (error) {
            console.error('加入房间失败:', error);
            message.error(error instanceof Error ? error.message : '加入房间失败，请重试');
        }
    };

    return (
        <>
            <Background />
            <div className="game-hall">
                {/* 左侧玩家信息区域 */}
                <div className="left-panel">
                    {/* 用户信息卡片 */}
                    <div className="user-info-card">
                        <div className="user-avatar">
                            <img src="https://picsum.photos/100/100" alt="用户头像" />
                        </div>
                        <div className="user-nickname">
                            {userLoading && <LoadingAnimation />}
                            {userError && <div>错误: {userError}</div>}
                            {userInfo && <div>欢迎, {userInfo.nickName}</div>}
                        </div>
                        <LogoutButton className="logout-btn"  />
                    </div>

                    {/* 玩家列表 */}
                    <div className="player-list">
                        <div className="player-list-header">
                            在线用户列表({onlineCount})
                        </div>
                        <div className="player-list-content">
                            {loading ? (
                                <div style={{ color: '#efefef', textAlign: 'center', padding: '20px' }}>
                                    <LoadingAnimation color="#efefef" />
                                </div>
                            ) : error ? (
                                <div style={{ color: '#ffbf00', textAlign: 'center', padding: '20px' }}>
                                    {error}
                                </div>
                            ) : onlineUsers.length === 0 ? (
                                <div style={{ color: '#efefef', textAlign: 'center', padding: '20px' }}>
                                    暂无在线用户
                                </div>
                            ) : (
                                onlineUsers.map((user) => (
                                    <div className="player-item" key={user.userId}>
                                        <div className="player-avatar">
                                            <img src="https://picsum.photos/100/100" alt="头像" />
                                        </div>
                                        <div className="player-info">
                                            <div className="player-name">{user.nickName}</div>
                                            <div className="player-status">{user.status} - {user.location}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* 右侧房间交互区域 */}
                <div className="right-panel">
                    {/* 标签栏 */}
                    <div className="tab-bar">
                        <button className="refresh-btn" onClick={() => loadRoomList()} disabled={roomLoading}>
                            {roomLoading ? '刷新中...' : '刷新'}
                        </button>
                        <div className="tab-item active">房间列表({roomList ? roomList.rooms.length : 0})</div>
                        <button className="create-room-btn" onClick={() => setShowCreateRoom(true)}>创建房间</button>
                    </div>

                    {/* 内容区域 */}
                    <div className="content-area">
                        {showCreateRoom ? (
                            /* 创建房间内容 */
                            <div className="create-room-content">
                                <div className="create-room-form">
                                    <h3>创建房间</h3>
                                    <div className="form-group">
                                        <label>房间名称:</label>
                                        <input
                                            type="text"
                                            value={roomName}
                                            onChange={(e) => setRoomName(e.target.value)}
                                            placeholder="请输入房间名称"
                                            maxLength={20}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>游戏模式:</label>
                                        <select
                                            value={gameMode}
                                            onChange={(e) => setGameMode(e.target.value as 'CLASSIC' | 'QUICK' | 'CUSTOM')}
                                        >
                                            <option value="CLASSIC">经典模式</option>
                                            <option value="QUICK">快速模式</option>
                                            <option value="CUSTOM">自定义模式</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                    <label>最大玩家数:</label>
                                    <select
                                        value={maxPlayers}
                                        onChange={(e) => setMaxPlayers(Number(e.target.value))}
                                    >
                                        <option value={2}>2人</option>
                                        <option value={3}>3人</option>
                                        <option value={4}>4人</option>
                                    </select>
                                </div>
                                    <div className="form-actions">
                                        <button
                                            className="cancel-btn"
                                            onClick={() => setShowCreateRoom(false)}
                                            disabled={creatingRoom}
                                        >
                                            取消
                                        </button>
                                        <button
                                            className="confirm-btn"
                                            onClick={handleCreateRoom}
                                            disabled={creatingRoom}
                                        >
                                            {creatingRoom ? '创建中...' : '创建房间'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* 房间列表内容 */
                            <div className="room-list-content">
                                {roomLoading ? (
                                    <div style={{ color: '#efefef', textAlign: 'center', padding: '20px' }}>
                                        <LoadingAnimation color="#efefef" />
                                    </div>
                                ) : roomError ? (
                                    <div style={{ color: '#ffbf00', textAlign: 'center', padding: '20px' }}>
                                        {roomError}
                                    </div>
                                ) : !roomList || roomList.rooms.length === 0 ? (
                                    <div style={{ color: '#efefef', textAlign: 'center', padding: '20px' }}>
                                        暂无房间
                                    </div>
                                ) : (
                                    roomList.rooms.map((room) => (
                                        <div className="room-item" key={room.roomId}>
                                            <div className="room-info">
                                                <div className="room-name">{room.roomName}</div>
                                                <div className="room-details">
                                                    <span>模式: {room.gameModeName}</span>
                                                    <span>玩家: {room.currentPlayerCount}/{room.maxPlayers}</span>
                                                    <span>状态: {room.roomStatus}</span>
                                                </div>
                                            </div>
                                            <button 
                                                className="join-room-btn"
                                                onClick={() => handleJoinRoom(room.roomId, room.roomName)}
                                            >
                                                加入房间
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}