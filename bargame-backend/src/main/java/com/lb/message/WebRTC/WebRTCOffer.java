package com.lb.message.WebRTC;

import lombok.Data;

@Data
public class WebRTCOffer {
    private String type; // "offer"
    private String sdp;
}
