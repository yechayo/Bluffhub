package com.lb.message.WebRTC;

import lombok.Data;

@Data
public class WebRTCAnswer {
    private String type; // "answer"
    private String sdp;
}
