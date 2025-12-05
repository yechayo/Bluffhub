package com.lb.message.enums;

import lombok.Getter;
import lombok.Setter;

@Getter
public enum CmdType {
    // --------------- 大厅模块 ---------------
    ONLINE_LIST("请求在线人员列表"),
    USER_ONLINE_PUSH("用户上线推送"),
    USER_OFFLINE_PUSH("用户下线推送"),
    RECONNECT("重连信息推送"),


    // --------------- 房间模块 ---------------

    ROOM_JOIN("加入房间"),
    ROOM_LEAVE("离开房间"),
    ROOM_CHAT("房间聊天"),
    PLAYER_PREPARE("玩家准备"),
    PLAYER_CANCEL_PREPARE("玩家取消准备"),
    
    // 推送型（后端→前端：保留 PUSH 后缀）
    ROOM_CHAT_PUSH("房间聊天广播"),
    ROOM_MEMBERS_PUSH("房间成员变动推送"),
    ROOM_STATE_PUSH("房间状态变动推送"),

    // --------------- 语音模块 ---------------
    WEBRTC_OFFER("WebRTC连接请求"),
    WEBRTC_ANSWER("WebRTC连接响应"),
    WEBRTC_ICE_CANDIDATE("WebRTC ICE候选信息"),

    // --------------- 系统模块 ---------------
    HEARTBEAT("心跳检测"),

    // --------------- 游戏模块 ---------------
    // 请求型（前端→后端：动作命名，无后缀）
    START_GAME("请求开始游戏"),
    PLAY_CARDS("玩家出牌"),
    CHALLENGE("玩家质疑"),
    LEAVE_GAME("玩家离开游戏"),

    // 推送型（后端→前端：事件命名，添加事件描述）
    GAME_STARTED("游戏开始通知"),
    PLAYER_SEATS("玩家座位信息广播"),
    PLAYER_PLAYED("玩家出牌广播"),
    CHALLENGE_RESULT("质疑结果通知"),
    GAME_LEAVE("玩家离开游戏广播"),
    NEW_ROUND("新一轮开始通知"),
    GAME_FINISHED("游戏结束通知");

    private final String desc;

    CmdType(String desc) {
        this.desc = desc;
    }

    // （可选）添加 getDesc 方法，方便日志打印/文档生成
    public String getDesc() {
        return desc;
    }
}
