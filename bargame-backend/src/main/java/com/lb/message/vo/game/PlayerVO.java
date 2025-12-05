package com.lb.message.vo.game;

import lombok.Data;

@Data
public class PlayerVO {

    /** 玩家ID */
    private Long playerId;

    /** 昵称 */
    private String nickname;

    /** 玩家状态（在线/离线/准备） */
    private String status;

    /** 玩家头像URL（可选） */
    private String avatar;

    /** 是否准备 */
    private Boolean isPrepared;

    /** 是否房主 */
    private Boolean isOwner;
}
