package com.lb.message.vo.hall;

/**
 * 在线人数列表响应
 */
import lombok.Data;
import java.util.List;

/**
 * 在线列表响应 VO（对齐 Map 结构：onlineCount + onlineUsers）
 */
@Data
public class OnlineListResponse {
    /** 在线用户总数（对应 map 中的 "onlineCount"） */
    private Integer onlineCount;

    /** 在线用户列表（对应 map 中的 "onlineUsers"，内部字段与 Map 完全一致） */
    private List<OnlineUserVO> onlineUsers;

    /**
     * 单个在线用户 VO（对应 list 中的每个 Map<String, Object>）
     */
    @Data
    public static class OnlineUserVO {
        /** 用户ID（对应 map 中的 "userId"） */
        private Long userId;

        /** 用户名（对应 map 中的 "username"） */
        private String username;

        /** 在线状态描述（对应 map 中的 "status"，如：在线/游戏中） */
        private String status;

        /** 位置描述（对应 map 中的 "location"，如：大厅/房间-888） */
        private String location;

        private String nickName;
    }
}
