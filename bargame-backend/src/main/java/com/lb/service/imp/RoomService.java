package com.lb.service.imp;

import com.lb.dto.resp.RoomResponse;
import com.lb.entity.Room;
import com.lb.entity.Player;
import com.lb.manager.RoomManager;
import com.lb.manager.ConnectionManager;
import com.lb.message.dto.room.JoinRoomRequest;
import com.lb.message.vo.room.RoomVO;
import com.lb.message.WebSocketMsg;
import com.lb.message.enums.ModuleType;
import com.lb.message.enums.CmdType;
import com.lb.message.WebRTC.WebRTCMsgData;
import com.lb.message.WebRTC.WebRTCOffer;
import com.lb.message.WebRTC.WebRTCAnswer;
import com.lb.message.WebRTC.WebRTCIceCandidate;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import com.lb.net.ConnectionContext;

import java.util.List;
import java.util.Map;

/**
 * 房间服务层
 * 职责：处理房间相关的业务逻辑
 */
@Slf4j
@Service
public class RoomService {

    @Autowired
    private RoomManager roomManager;

    @Autowired
    private ConnectionManager connectionManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 创建房间
     *
     * @param ownerId    房主ID
     * @param roomName   房间名称
     * @param gameMode   游戏模式
     * @param maxPlayers 最大玩家数量
     * @return 创建的房间
     */
    public RoomVO createRoom(Long ownerId, String roomName, Room.GameMode gameMode, Integer maxPlayers) {
        try {
            // 参数验证
            if (roomName == null || roomName.trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "房间名称不能为空");
            }
            if (maxPlayers == null || maxPlayers < 2 || maxPlayers > 4) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "最大玩家数量必须在2-4之间");
            }
            if (gameMode == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "游戏模式不能为空");
            }
            Room room = roomManager.createRoom(ownerId, roomName, gameMode, maxPlayers);

            // 调用RoomManager创建房间
            return room.toRoomVO();

        } catch (ResponseStatusException e) {
            // 重新抛出已处理的ResponseStatusException
            throw e;
        } catch (IllegalArgumentException e) {
            // 处理RoomManager抛出的业务异常（如：房主不存在、玩家已在其他房间等）
            log.warn("创建房间参数异常：ownerId={}, error={}", ownerId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            // 处理状态冲突异常（如：玩家已在其他房间）
            log.warn("创建房间状态异常：ownerId={}, error={}", ownerId, e.getMessage());
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        } catch (Exception e) {
            // 处理其他未预期的异常，记录详细日志但返回友好信息
            log.error("创建房间失败：ownerId={}, roomName={}, error={}", ownerId, roomName, e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "创建房间失败，请稍后重试");
        }
    }

    /**
     * 获取所有房间列表（分页）
     *
     * @param current 当前页码，从1开始
     * @param size 每页大小
     * @return 分页房间列表响应
     */
    public RoomResponse getAllRooms(int current, int size) {
        try {
            // 参数验证
            if (current < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "页码必须大于0");
            }
            if (size < 1 || size > 100) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "每页大小必须在1-100之间");
            }

            // 获取所有活跃房间列表
            List<Room> allRooms = roomManager.getActiveRoomList();
            return paginateRooms(allRooms, current, size);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("获取房间列表失败：current={}, size={}, error={}", current, size, e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "获取房间列表失败: " + e.getMessage());
        }
    }

    /**
     * 获取可加入的房间列表（分页）
     *
     * @param current 当前页码，从1开始
     * @param size 每页大小
     * @return 分页可加入房间列表响应
     */
    public RoomResponse getAvailableRooms(int current, int size) {
        try {
            // 参数验证
            if (current < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "页码必须大于0");
            }
            if (size < 1 || size > 100) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "每页大小必须在1-100之间");
            }

            // 获取可加入的房间列表
            List<Room> availableRooms = roomManager.getAvailableRoomList();
            return paginateRooms(availableRooms, current, size);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("获取可加入房间列表失败：current={}, size={}, error={}", current, size, e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "获取可加入房间列表失败: " + e.getMessage());
        }
    }

    /**
     * 房间列表分页处理
     *
     * @param rooms   房间列表
     * @param current 当前页码
     * @param size    每页大小
     * @return 分页响应
     */
    private RoomResponse paginateRooms(List<Room> rooms, int current, int size) {
        RoomResponse response = new RoomResponse();

        // 设置分页基本信息
        response.setCurrent(current);
        response.setSize(size);
        response.setTotal(rooms.size());

        // 计算分页范围
        int totalRecords = rooms.size();
        int startIndex = (current - 1) * size;
        int endIndex = Math.min(startIndex + size, totalRecords);

        // 如果开始索引超出范围，返回空列表
        if (startIndex >= totalRecords) {
            response.setRooms(List.of());
            return response;
        }

        // 获取当前页的数据并转换为RoomVO列表
        List<RoomVO> roomVOList = rooms.subList(startIndex, endIndex)
                .stream()
                .map(Room::toRoomVO)
                .collect(java.util.stream.Collectors.toList());

        response.setRooms(roomVOList);
        return response;
    }

    public WebSocketMsg<RoomVO> joinRoom(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 1. 从ConnectionContext获取用户ID
            Long userId = connectionContext.getUserId();
            if (userId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_JOIN,
                                       401, "用户未认证或连接无效");
            }

            // 2. 解析请求数据
            JoinRoomRequest request;
            if (msg.getData() instanceof JoinRoomRequest) {
                request = (JoinRoomRequest) msg.getData();
            } else if (msg.getData() instanceof Map) {
                // 如果data是Map，尝试转换为JoinRoomRequest
                request = objectMapper.convertValue(msg.getData(), JoinRoomRequest.class);
            } else {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_JOIN,
                                       400, "请求参数格式错误");
            }

            // 3. 参数验证
            if (request.getRoomId() == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_JOIN,
                                       400, "房间ID不能为空");
            }

            // 4. 检查用户是否在线
            if (!connectionManager.isUserOnline(userId)) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_JOIN,
                                       400, "用户不在线");
            }

            // 5. 加入房间（RoomManager会处理玩家状态更新）
            Room updatedRoom = roomManager.joinRoom(userId, request.getRoomId());
            if (updatedRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_JOIN,
                                       500, "加入房间失败");
            }

            // 6. 转换为VO对象
            RoomVO roomVO = updatedRoom.toRoomVO();

            // 7. 向房间内所有玩家广播房间状态更新
            broadcastRoomUpdate(updatedRoom);

            // 8. 返回成功响应
            return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_JOIN, roomVO);

        } catch (Exception e) {
            log.error("加入房间失败: msg={}, error={}", msg, e.getMessage(), e);
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_JOIN,
                                   500, "服务器内部错误");
        }
    }

    /**
     * 向房间内所有玩家广播房间状态更新
     *
     * @param room 房间对象
     */
    private void  broadcastRoomUpdate(Room room) {
        try {
            RoomVO roomVO = room.toRoomVO();
            String message = objectMapper.writeValueAsString(
                WebSocketMsg.push(ModuleType.ROOM, CmdType.ROOM_MEMBERS_PUSH, roomVO)
            );

            // 向房间内每个玩家发送更新消息
            for (Player player : room.getAllPlayers().values()) {
                if (connectionManager.isUserOnline(player.getUserId())) {
                    connectionManager.sendMessageToUser(player.getUserId(), message);
                }
            }

            log.debug("房间状态更新已广播: roomId={}, playerCount={}",
                     room.getRoomId(), room.getCurrentPlayerCount());

        } catch (Exception e) {
            log.error("广播房间状态更新失败: roomId={}, error={}", room.getRoomId(), e.getMessage(), e);
        }
    }

    public WebSocketMsg<RoomVO> leaveRoom(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 1. 从ConnectionContext获取用户ID
            log.info("清理房间中, connectionId={}", connectionContext.getId());
            Long userId = connectionContext.getUserId();
            if (userId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_LEAVE,
                                       401, "用户未认证或连接无效");
            }
            Player currentPlayer = connectionManager.getPlayerByUserId(userId);

            // 2. 获取用户当前房间信息，用于后续广播
            Room currentRoom = roomManager.getPlayerRoom(userId);

            // 3. 校验用户是否在房间中
            if (currentRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_LEAVE,
                                       400, "用户不在任何房间中");
            }

            // 4. 离开房间
            Room updatedRoom = roomManager.leaveRoom(userId);

            if (updatedRoom.getAllPlayers().isEmpty()) {
                // 房间已解散，创建一个包含解散信息的VO
                RoomVO roomVO = new RoomVO();
                roomVO.setRoomId(currentRoom.getRoomId());
                roomVO.setRoomName(currentRoom.getRoomName());
                roomVO.setRoomStatus("已解散");
                roomVO.setCurrentPlayerCount(0);
                roomVO.setPlayers(List.of());

                // 5. 更新玩家状态
                currentPlayer.leaveRoom();

                // 6. 返回成功响应（房间解散）
                return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_LEAVE, roomVO);
            }

            // 5. 更新玩家状态
            currentPlayer.leaveRoom();

            // 6. 房间还存在，转换为VO对象
            RoomVO roomVO = updatedRoom.toRoomVO();

            // 7. 向房间内剩余玩家广播房间状态更新
            broadcastRoomUpdate(updatedRoom);


            // 8. 返回成功响应
            return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_LEAVE, roomVO);

        } catch (Exception e) {
            log.error("离开房间失败: msg={}, error={}", msg, e.getMessage(), e);
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.ROOM_LEAVE,
                                   500, "服务器内部错误");
        }
    }

    /**
     * 处理WebRTC连接请求
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> handleWebRTCOffer(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 1. 从ConnectionContext获取发送方用户ID
            Long fromUserId = connectionContext.getUserId();
            if (fromUserId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       401, "用户未认证或连接无效");
            }

            // 2. 解析WebRTC消息数据 - 由于泛型擦除，需要手动处理Map
            WebRTCMsgData<WebRTCOffer> webRTCData;
            if (msg.getData() instanceof Map) {
                // 将Map转换为WebRTCMsgData<WebRTCOffer>
                @SuppressWarnings("unchecked")
                Map<String, Object> dataMap = (Map<String, Object>) msg.getData();

                webRTCData = new WebRTCMsgData<>();
                webRTCData.setFrom((String) dataMap.get("from"));
                webRTCData.setTo((String) dataMap.get("to"));

                // 将内部的数据Map转换为WebRTCOffer对象
                if (dataMap.get("data") instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> offerMap = (Map<String, Object>) dataMap.get("data");
                    WebRTCOffer offerData = new WebRTCOffer();
                    offerData.setType((String) offerMap.get("type"));
                    offerData.setSdp((String) offerMap.get("sdp"));
                    webRTCData.setData(offerData);
                }
            } else if (msg.getData() instanceof WebRTCMsgData) {
                webRTCData = (WebRTCMsgData<WebRTCOffer>) msg.getData();
            } else {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       400, "WebRTC消息参数格式错误");
            }

            // 3. 验证必要字段
            if (webRTCData.getTo() == null || webRTCData.getData() == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       400, "WebRTC消息缺少必要字段：to或data");
            }

            Long toUserId = Long.parseLong(webRTCData.getTo());

            // 4. 验证发送方和接收方是否在同一房间内
            Room fromRoom = roomManager.getPlayerRoom(fromUserId);
            Room toRoom = roomManager.getPlayerRoom(toUserId);

            if (fromRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       400, "发送方不在任何房间中");
            }

            if (toRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       400, "接收方不在任何房间中");
            }

            if (!fromRoom.getRoomId().equals(toRoom.getRoomId())) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       400, "发送方和接收方不在同一房间内");
            }

            // 5. 验证发送方是否有权限发起语音连接（房间内的玩家都可以发起语音连接）
            if (!fromRoom.getAllPlayers().containsKey(fromUserId)) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       403, "发送方无权限发起语音连接");
            }

            // 6. 验证接收方是否在线
            if (!connectionManager.isUserOnline(toUserId)) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       404, "接收方不在线");
            }

            // 7. 构建转发给目标用户的WebRTC Offer消息
            WebRTCMsgData<WebRTCOffer> forwardData = new WebRTCMsgData<>();
            forwardData.setFrom(fromUserId.toString());
            forwardData.setTo(toUserId.toString());
            forwardData.setData(webRTCData.getData());

            // 8. 转发消息给目标用户
            String forwardMessage = objectMapper.writeValueAsString(
                WebSocketMsg.push(ModuleType.ROOM, CmdType.WEBRTC_OFFER, forwardData)
            );
            connectionManager.sendMessageToUser(toUserId, forwardMessage);

            log.info("WebRTC Offer消息已转发: from={}, to={}, roomId={}",
                    fromUserId, toUserId, fromRoom.getRoomId());

            // 9. 返回成功响应
            return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                       Map.of("status", "forwarded", "to", toUserId.toString()));

        } catch (NumberFormatException e) {
            log.error("WebRTC Offer处理失败: 用户ID格式错误, error={}", e.getMessage());
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                   400, "用户ID格式错误");
        } catch (Exception e) {
            log.error("WebRTC Offer处理失败: msg={}, error={}", msg, e.getMessage(), e);
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_OFFER,
                                   500, "服务器内部错误");
        }
    }

    /**
     * 处理WebRTC连接响应
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> handleWebRTCAnswer(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 1. 从ConnectionContext获取发送方用户ID
            Long fromUserId = connectionContext.getUserId();
            if (fromUserId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       401, "用户未认证或连接无效");
            }

            // 2. 解析WebRTC消息数据 - 由于泛型擦除，需要手动处理Map
            WebRTCMsgData<WebRTCAnswer> webRTCData;
            if (msg.getData() instanceof Map) {
                // 将Map转换为WebRTCMsgData<WebRTCAnswer>
                @SuppressWarnings("unchecked")
                Map<String, Object> dataMap = (Map<String, Object>) msg.getData();

                webRTCData = new WebRTCMsgData<>();
                webRTCData.setFrom((String) dataMap.get("from"));
                webRTCData.setTo((String) dataMap.get("to"));

                // 将内部的数据Map转换为WebRTCAnswer对象
                if (dataMap.get("data") instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> answerMap = (Map<String, Object>) dataMap.get("data");
                    WebRTCAnswer answerData = new WebRTCAnswer();
                    answerData.setType((String) answerMap.get("type"));
                    answerData.setSdp((String) answerMap.get("sdp"));
                    webRTCData.setData(answerData);
                }
            } else if (msg.getData() instanceof WebRTCMsgData) {
                webRTCData = (WebRTCMsgData<WebRTCAnswer>) msg.getData();
            } else {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       400, "WebRTC消息参数格式错误");
            }

            // 3. 验证必要字段
            if (webRTCData.getTo() == null || webRTCData.getData() == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       400, "WebRTC消息缺少必要字段：to或data");
            }

            Long toUserId = Long.parseLong(webRTCData.getTo());

            // 4. 验证发送方和接收方是否在同一房间内
            Room fromRoom = roomManager.getPlayerRoom(fromUserId);
            Room toRoom = roomManager.getPlayerRoom(toUserId);

            if (fromRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       400, "发送方不在任何房间中");
            }

            if (toRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       400, "接收方不在任何房间中");
            }

            if (!fromRoom.getRoomId().equals(toRoom.getRoomId())) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       400, "发送方和接收方不在同一房间内");
            }

            // 5. 验证接收方是否在线
            if (!connectionManager.isUserOnline(toUserId)) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       404, "接收方不在线");
            }

            // 6. 构建转发给目标用户的WebRTC Answer消息
            WebRTCMsgData<WebRTCAnswer> forwardData = new WebRTCMsgData<>();
            forwardData.setFrom(fromUserId.toString());
            forwardData.setTo(toUserId.toString());
            forwardData.setData(webRTCData.getData());

            // 7. 转发消息给目标用户
            String forwardMessage = objectMapper.writeValueAsString(
                WebSocketMsg.push(ModuleType.ROOM, CmdType.WEBRTC_ANSWER, forwardData)
            );
            connectionManager.sendMessageToUser(toUserId, forwardMessage);

            log.info("WebRTC Answer消息已转发: from={}, to={}, roomId={}",
                    fromUserId, toUserId, fromRoom.getRoomId());

            // 8. 返回成功响应
            return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                       Map.of("status", "forwarded", "to", toUserId.toString()));

        } catch (NumberFormatException e) {
            log.error("WebRTC Answer处理失败: 用户ID格式错误, error={}", e.getMessage());
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                   400, "用户ID格式错误");
        } catch (Exception e) {
            log.error("WebRTC Answer处理失败: msg={}, error={}", msg, e.getMessage(), e);
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ANSWER,
                                   500, "服务器内部错误");
        }
    }

    /**
     * 处理WebRTC ICE候选信息
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> handleWebRTCIceCandidate(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 1. 从ConnectionContext获取发送方用户ID
            Long fromUserId = connectionContext.getUserId();
            if (fromUserId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       401, "用户未认证或连接无效");
            }

            // 2. 解析WebRTC消息数据 - 由于泛型擦除，需要手动处理Map
            WebRTCMsgData<WebRTCIceCandidate> webRTCData;
            if (msg.getData() instanceof Map) {
                // 将Map转换为WebRTCMsgData<WebRTCIceCandidate>
                @SuppressWarnings("unchecked")
                Map<String, Object> dataMap = (Map<String, Object>) msg.getData();

                webRTCData = new WebRTCMsgData<>();
                webRTCData.setFrom((String) dataMap.get("from"));
                webRTCData.setTo((String) dataMap.get("to"));

                // 将内部的数据Map转换为WebRTCIceCandidate对象
                if (dataMap.get("data") instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> candidateMap = (Map<String, Object>) dataMap.get("data");
                    WebRTCIceCandidate candidateData = new WebRTCIceCandidate();
                    candidateData.setCandidate((String) candidateMap.get("candidate"));
                    candidateData.setSdpMLineIndex((Integer) candidateMap.get("sdpMLineIndex"));
                    candidateData.setSdpMid((String) candidateMap.get("sdpMid"));
                    webRTCData.setData(candidateData);
                }
            } else if (msg.getData() instanceof WebRTCMsgData) {
                webRTCData = (WebRTCMsgData<WebRTCIceCandidate>) msg.getData();
            } else {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       400, "WebRTC消息参数格式错误");
            }

            // 3. 验证必要字段
            if (webRTCData.getTo() == null || webRTCData.getData() == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       400, "WebRTC消息缺少必要字段：to或data");
            }

            Long toUserId = Long.parseLong(webRTCData.getTo());

            // 4. 验证发送方和接收方是否在同一房间内
            Room fromRoom = roomManager.getPlayerRoom(fromUserId);
            Room toRoom = roomManager.getPlayerRoom(toUserId);

            if (fromRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       400, "发送方不在任何房间中");
            }

            if (toRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       400, "接收方不在任何房间中");
            }

            if (!fromRoom.getRoomId().equals(toRoom.getRoomId())) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       400, "发送方和接收方不在同一房间内");
            }

            // 5. 验证接收方是否在线
            if (!connectionManager.isUserOnline(toUserId)) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       404, "接收方不在线");
            }

            // 6. 构建转发给目标用户的WebRTC ICE Candidate消息
            WebRTCMsgData<WebRTCIceCandidate> forwardData = new WebRTCMsgData<>();
            forwardData.setFrom(fromUserId.toString());
            forwardData.setTo(toUserId.toString());
            forwardData.setData(webRTCData.getData());

            // 7. 转发消息给目标用户
            String forwardMessage = objectMapper.writeValueAsString(
                WebSocketMsg.push(ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE, forwardData)
            );
            connectionManager.sendMessageToUser(toUserId, forwardMessage);

            log.info("WebRTC ICE Candidate消息已转发: from={}, to={}, roomId={}",
                    fromUserId, toUserId, fromRoom.getRoomId());

            // 8. 返回成功响应
            return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                       Map.of("status", "forwarded", "to", toUserId.toString()));

        } catch (NumberFormatException e) {
            log.error("WebRTC ICE Candidate处理失败: 用户ID格式错误, error={}", e.getMessage());
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                   400, "用户ID格式错误");
        } catch (Exception e) {
            log.error("WebRTC ICE Candidate处理失败: msg={}, error={}", msg, e.getMessage(), e);
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.WEBRTC_ICE_CANDIDATE,
                                   500, "服务器内部错误");
        }
    }

   
    /**
     * 处理玩家准备操作
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> playerPrepare(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 1. 从ConnectionContext获取用户信息
            Long userId = connectionContext.getUserId();
            if (userId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_PREPARE,
                                       401, "用户未认证或连接无效");
            }
            Player currentPlayer = connectionManager.getPlayerByUserId(userId);
            // 2. 检查用户是否在房间中
            Room currentRoom = roomManager.getPlayerRoom(userId);
            if (currentRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_PREPARE,
                                       400, "用户不在任何房间中");
            }

            // 3. 调用玩家的ready方法
            currentPlayer.ready();

            // 4. 向房间内所有玩家广播房间状态更新
            broadcastRoomUpdate(currentRoom);

            return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_PREPARE, null);

        } catch (Exception e) {
            log.error("玩家准备失败: msg={}, error={}", msg, e.getMessage(), e);
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_PREPARE,
                                   500, "服务器内部错误");
        }
    }

    /**
     * 处理玩家取消准备操作
     * @param msg WebSocket消息
     * @param connectionContext 连接上下文
     * @return 响应消息
     */
    public WebSocketMsg<?> playerCancelPrepare(WebSocketMsg<?> msg, ConnectionContext connectionContext) {
        try {
            // 1. 从ConnectionContext获取用户信息
            Long userId = connectionContext.getUserId();
            if (userId == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_CANCEL_PREPARE,
                                       401, "用户未认证或连接无效");
            }
            Player currentPlayer = connectionManager.getPlayerByUserId(userId);
            // 2. 检查用户是否在房间中
            Room currentRoom = roomManager.getPlayerRoom(userId);
            if (currentRoom == null) {
                return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_CANCEL_PREPARE,
                                       400, "用户不在任何房间中");
            }

            // 3. 调用玩家的取消准备方法
            currentPlayer.unready();

            // 4. 向房间内所有玩家广播房间状态更新
            broadcastRoomUpdate(currentRoom);

            // 5. 返回成功响应
            RoomVO roomVO = currentRoom.toRoomVO();
            return WebSocketMsg.response(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_CANCEL_PREPARE, roomVO);

        } catch (Exception e) {
            log.error("玩家取消准备失败: msg={}, error={}", msg, e.getMessage(), e);
            return WebSocketMsg.error(msg.getRequestId(), ModuleType.ROOM, CmdType.PLAYER_CANCEL_PREPARE,
                                   500, "服务器内部错误");
        }
    }
}
