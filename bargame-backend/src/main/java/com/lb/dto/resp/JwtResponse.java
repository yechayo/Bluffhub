package com.lb.dto.resp;

import com.lb.entity.UserEntity;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@Builder
@ToString
public class JwtResponse {

    private String token;
    private UserEntity userDetails;

    public JwtResponse(String token, UserEntity userDetails) {
        this.token = token;
        this.userDetails = userDetails;
    }

    public JwtResponse(String token) {
        this.token = token;
    }
}
