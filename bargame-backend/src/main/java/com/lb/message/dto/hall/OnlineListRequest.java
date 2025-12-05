package com.lb.message.dto.hall;

import lombok.Data;


/**
 * 在线人数列表请求
 */
@Data
public class OnlineListRequest {
    // 无业务字段（前端只需发送指令，无需传参）
    // 若后续需要分页/筛选，可在此新增字段（如 pageNo、pageSize、onlineStatus）
}