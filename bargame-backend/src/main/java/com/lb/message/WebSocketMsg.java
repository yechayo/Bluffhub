package com.lb.message;

import com.lb.message.enums.CmdType;
import com.lb.message.enums.ModuleType;
import lombok.Data;

/**
 * WebSocket 统一消息体（前后端通信的根结构）
 * 说明：
 * - 推送类消息（如人员上线）：无需 requestId
 * - 请求-响应类消息（如获取房间列表）：requestId 用于关联请求和响应
 */
@Data
public class WebSocketMsg<T> {
    /** 消息唯一标识（请求-响应模式必传，用于匹配响应） */
    private String requestId;

    /** 业务模块类型（枚举：HALL=大厅，ROOM=房间，GAME=游戏） */
    private ModuleType module;

    /** 指令类型（每个模块下的具体操作，如：ONLINE_LIST=在线列表，CHAT=聊天） */
    private CmdType cmd;

    /** 状态码（200=成功，400=参数错误，500=服务器错误，1xxx=业务异常） */
    private Integer code = 200;

    /** 状态描述（错误时返回具体信息） */
    private String msg = "success";

    /** 业务数据体（根据 module + cmd 动态变化，如：在线列表数据、聊天内容） */
    private T data;

    // 快捷构造方法（推送类消息）
    public static <T> WebSocketMsg<T> push(ModuleType module, CmdType cmd, T data) {
        WebSocketMsg<T> msg = new WebSocketMsg<>();
        msg.setModule(module);
        msg.setCmd(cmd);
        msg.setData(data);
        return msg;
    }

    // 快捷构造方法（响应类消息）
    public static <T> WebSocketMsg<T> response(String requestId, ModuleType module, CmdType cmd, T data) {
        WebSocketMsg<T> msg = new WebSocketMsg<>();
        msg.setRequestId(requestId);
        msg.setModule(module);
        msg.setCmd(cmd);
        msg.setData(data);
        return msg;
    }

    // 快捷构造方法（错误响应）
    public static <T> WebSocketMsg<T> error(String requestId, ModuleType module, CmdType cmd, Integer code, String errMsg) {
        WebSocketMsg<T> msg = new WebSocketMsg<>();
        msg.setRequestId(requestId);
        msg.setModule(module);
        msg.setCmd(cmd);
        msg.setCode(code);
        msg.setMsg(errMsg);
        return msg;
    }
}