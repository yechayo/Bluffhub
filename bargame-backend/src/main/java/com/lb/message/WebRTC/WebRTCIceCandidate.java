package com.lb.message.WebRTC;

import lombok.Data;

@Data
public class WebRTCIceCandidate {
    private String candidate;
    private Integer sdpMLineIndex;
    private String sdpMid;
}
