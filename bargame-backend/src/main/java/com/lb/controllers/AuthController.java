package com.lb.controllers;

import com.lb.Auth.JwtHelper;
import com.lb.config.AuthConfig;
import com.lb.dto.req.JwtRequest;
import com.lb.dto.req.UserRequestDto;
import com.lb.dto.resp.JwtResponse;
import com.lb.dto.resp.UserResponseDto;
import com.lb.entity.UserEntity;
import com.lb.exp.UserAlreadyExistsException;
import com.lb.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

/**
 * 用户认证控制器
 * 负责用户注册、登录和 Token 生成。
 * 路径统一以 /auth 开头。
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthConfig authConfig;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private AuthenticationManager manager;

    @Autowired
    private JwtHelper helper;

    @Autowired
    private UserService userService;

    /**
     * 注册接口
     * 用户提交注册信息后，系统保存用户并返回 JWT Token。
     */
    @PostMapping("/create")
    public ResponseEntity<JwtResponse> createUser(@RequestBody UserRequestDto userRequestDto) {
        try {
            // 创建用户
            UserResponseDto userResponseDto = userService.createUser(userRequestDto);

            // 根据邮箱从数据库加载用户详情
            UserDetails userDetails = userDetailsService.loadUserByUsername(userResponseDto.getEmail());
            System.out.println("从数据库加载的用户信息：");
            System.out.println("用户名：" + userDetails.getUsername());
            System.out.println("密码：" + userDetails.getPassword());

            // 生成 JWT Token
            String token = this.helper.generateToken(userDetails);
            JwtResponse jwtResponse = JwtResponse.builder().token(token).build();

            logger.info("用户 [{}] 注册成功，生成 Token。", userDetails.getUsername());
            return new ResponseEntity<>(jwtResponse, HttpStatus.CREATED);

        } catch (UserAlreadyExistsException ex) {
            // 如果用户已存在，返回冲突状态码
            logger.warn("注册失败：用户已存在。{}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new JwtResponse("用户已存在：" + ex.getMessage()));
        }
    }

    /**
     * 登录接口
     * 验证用户邮箱和密码，成功后返回 JWT Token。
     */
    @PostMapping("/login")
    public ResponseEntity<JwtResponse> login(@RequestBody JwtRequest jwtRequest) {
        this.doAuthenticate(jwtRequest.getEmail(), jwtRequest.getPassword());

        // 登录成功后加载用户信息
        UserEntity userDetails = (UserEntity)userDetailsService.loadUserByUsername(jwtRequest.getEmail());
        // 生成 JWT
        String token = this.helper.generateToken(userDetails);
        JwtResponse jwtResponse = JwtResponse.builder().token(token).userDetails(userDetails).build();

        logger.info("用户 [{}] 登录成功，已生成 JWT Token。", jwtRequest.getEmail());
        return new ResponseEntity<>(jwtResponse, HttpStatus.OK);
    }

    /**
     * 实际的登录验证逻辑
     * 通过 AuthenticationManager 验证用户名和密码。
     */
    private void doAuthenticate(String email, String password) {
        System.out.println("开始进行登录验证：");
        System.out.println("邮箱：" + email);
        System.out.println("密码：" + password);
        System.out.println("------------------");

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(email, password);

        try {
            logger.info("开始验证用户 [{}] 的凭证。", email);
            manager.authenticate(authentication); // 调用 Spring Security 的认证逻辑

            // 登录成功，将认证信息存入 SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);
            logger.info("用户 [{}] 认证成功，已写入 SecurityContext。", email);

        } catch (BadCredentialsException e) {
            logger.error("用户 [{}] 登录失败，用户名或密码错误！", email);
            throw new BadCredentialsException("用户名或密码错误！");
        }
    }

    /**
     * 统一异常处理
     * 捕获登录失败时的 BadCredentialsException。
     */
    @ExceptionHandler(BadCredentialsException.class)
    public String exceptionHandler(BadCredentialsException ex) {
        logger.error("登录凭证无效：{}", ex.getMessage());
        return "用户名或密码无效！";
    }
}