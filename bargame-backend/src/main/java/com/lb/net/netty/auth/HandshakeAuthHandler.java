package com.lb.net.netty.auth;

import com.lb.Auth.JwtHelper;
import com.lb.entity.UserEntity;
import com.lb.mapper.UserMapper;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpHeaderValues;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.util.AttributeKey;
import lombok.extern.slf4j.Slf4j;

import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * WebSocket握手认证处理器
 * 只在握手阶段执行认证，完成后自动移除自己
 *
 * @author LiarBar
 * @version 1.0
 */
@Slf4j
public class HandshakeAuthHandler extends ChannelInboundHandlerAdapter {

    private final JwtHelper jwtHelper;
    private final UserMapper userMapper;

    // Channel属性键
    public static final AttributeKey<Long> USER_ID_ATTR = AttributeKey.valueOf("userId");
    public static final AttributeKey<String> USERNAME_ATTR = AttributeKey.valueOf("username");


    public HandshakeAuthHandler(JwtHelper jwtHelper, UserMapper userMapper) {
        this.jwtHelper = jwtHelper;
        this.userMapper = userMapper;
    }

    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        log.info("HandshakeAuthHandler接收到消息: {}, Channel: {}",
                msg.getClass().getSimpleName(), ctx.channel().id().asShortText());

        if (msg instanceof FullHttpRequest) {
            FullHttpRequest request = (FullHttpRequest) msg;
            log.info("处理HTTP请求: URI={}, Method={}, RemoteAddress={}",
                    request.uri(), request.method().name(), ctx.channel().remoteAddress());

            // 执行认证
            AuthResult authResult = authenticateUser(request);
            if (authResult == null) {
                log.warn("WebSocket握手认证失败: {}", ctx.channel().remoteAddress());
                sendAuthErrorResponse(ctx, request);
                return;
            }

            // 存储用户信息到Channel属性中
            ctx.channel().attr(USER_ID_ATTR).set(authResult.getUserId());
            ctx.channel().attr(USERNAME_ATTR).set(authResult.getUsername());

            log.info("WebSocket握手认证成功: userId={}, username={}, channel={}",
                    authResult.getUserId(), authResult.getUsername(), ctx.channel().id().asShortText());

            // 剥离查询参数，修改URI为纯路径，以便WebSocketServerProtocolHandler正确处理
            String originalUri = request.uri();
            int queryIndex = originalUri.indexOf('?');
            if (queryIndex != -1) {
                String cleanUri = originalUri.substring(0, queryIndex);
                request.setUri(cleanUri);
                log.info("修改URI从 {} 到 {}", originalUri, cleanUri);
            }

        }

        // 传递给下一个处理器
        super.channelRead(ctx, msg);
    }

    /**
     * 认证结果
     */
    private static class AuthResult {
        private final Long userId;
        private final String username;

        public AuthResult(Long userId, String username) {
            this.userId = userId;
            this.username = username;
        }

        public Long getUserId() {
            return userId;
        }

        public String getUsername() {
            return username;
        }
    }

    /**
     * 从HTTP请求中认证用户
     */
    private AuthResult authenticateUser(FullHttpRequest request) {
        try {
            // 1. 从请求URI中获取query参数
            String uri = request.uri();
            log.info("uri={}", uri);
            String query = null;

            // 查找问号分隔符，提取query部分
            int queryIndex = uri.indexOf('?');
            if (queryIndex != -1 && queryIndex < uri.length() - 1) {
                query = uri.substring(queryIndex + 1);
            }

            if (query == null || query.trim().isEmpty()) {
                log.warn("WebSocket握手失败：缺少token参数");
                return null;
            }

            // 2. 解析query参数，获取token
            String token = null;
            String[] queryParams = query.split("&");
            for (String param : queryParams) {
                String[] keyValue = param.split("=");
                if (keyValue.length == 2 && "token".equals(keyValue[0])) {
                    token = keyValue[1];
                    break;
                }
            }

            if (token == null || token.trim().isEmpty()) {
                log.warn("WebSocket握手失败：token参数为空");
                return null;
            }

            token = token.trim();

            // 3. 验证JWT Token
            if (jwtHelper == null) {
                log.error("JWT助手未初始化");
                return null;
            }

            try {
                // 验证token并获取用户名
                String username = jwtHelper.getUsernameFromToken(token);
                if (username == null || username.trim().isEmpty()) {
                    log.warn("WebSocket握手失败：无法从token中解析用户名");
                    return null;
                }

                // 检查Token是否过期
                Date expirationDate = jwtHelper.getExpirationDateFromToken(token);
                if (expirationDate != null && expirationDate.before(new Date())) {
                    log.warn("WebSocket握手失败：Token已过期，用户需要重新登录");
                    return null;
                }

                // 4. 根据用户名查询用户信息
                UserEntity user = userMapper.findByEmail(username);
                if (user == null) {
                    log.warn("WebSocket握手失败：用户不存在，用户名: {}", username);
                    return null;
                }
                Long userId = user.getId();

                return new AuthResult(userId, username);

            } catch (io.jsonwebtoken.ExpiredJwtException e) {
                log.warn("WebSocket握手失败：Token已过期，用户需要重新登录");
                return null;
            } catch (io.jsonwebtoken.MalformedJwtException e) {
                log.warn("WebSocket握手失败：Token格式错误");
                return null;
            } catch (io.jsonwebtoken.SignatureException e) {
                log.warn("WebSocket握手失败：Token签名验证失败");
                return null;
            } catch (Exception e) {
                log.warn("JWT Token解析失败: {}", e.getMessage());
                return null;
            }

        } catch (Exception e) {
            log.error("WebSocket认证过程中发生异常: {}", e.getMessage(), e);
            return null;
        }
    }

  
    /**
     * 发送认证失败响应
     */
    private static void sendAuthErrorResponse(ChannelHandlerContext ctx, FullHttpRequest request) {
        try {
            String errorMessage = "{\"code\":401,\"message\":\"认证失败，请提供有效的JWT Token\"}";

            DefaultFullHttpResponse response = new DefaultFullHttpResponse(
                HttpVersion.HTTP_1_1,
                HttpResponseStatus.UNAUTHORIZED,
                ctx.alloc().buffer().writeBytes(errorMessage.getBytes(StandardCharsets.UTF_8))
            );

            response.headers().set(HttpHeaderNames.CONTENT_TYPE, HttpHeaderValues.APPLICATION_JSON);
            response.headers().set(HttpHeaderNames.CONTENT_LENGTH, response.content().readableBytes());
            response.headers().set(HttpHeaderNames.CONNECTION, HttpHeaderValues.CLOSE);

            ctx.writeAndFlush(response).addListener(future -> ctx.close());

        } catch (Exception e) {
            log.error("发送认证失败响应时发生异常: {}", e.getMessage(), e);
            ctx.close();
        }
    }
}