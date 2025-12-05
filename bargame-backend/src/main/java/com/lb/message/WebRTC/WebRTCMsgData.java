package com.lb.message.WebRTC;

import lombok.Data;

@Data
public class WebRTCMsgData<T> {
    private String from; // 发送方ID
    private String to;   // 接收方ID
    private T data;      // 动态数据：Offer/Answer/Candidate
}


