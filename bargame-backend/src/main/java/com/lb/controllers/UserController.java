package com.lb.controllers;

import com.lb.dto.resp.UserResponseDto;
import com.lb.entity.Player;
import com.lb.entity.UserEntity;
import com.lb.manager.UserStateManager;
import com.lb.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/user")
@Slf4j
public class UserController {
    @Autowired
    private UserService userService;
    @Autowired
    private UserStateManager userStateManager;
    @GetMapping
    public ResponseEntity<List<UserResponseDto>> getAllUser(){
        return new ResponseEntity<>( userService.getAllUser(), HttpStatus.OK);
    }

    @GetMapping("/info")
    public ResponseEntity<Player> resUser(@AuthenticationPrincipal UserDetails user){
        Player userState = userStateManager.getUserState(((UserEntity) user).getId());
        return ResponseEntity.ok(userState);
    }

}
