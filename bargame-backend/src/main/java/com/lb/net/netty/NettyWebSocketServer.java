package com.lb.net.netty;

import com.lb.Auth.JwtHelper;
import com.lb.net.netty.handler.NettyWebSocketServerHandler;
import com.lb.net.netty.auth.HandshakeAuthHandler;
import com.lb.mapper.UserMapper;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import io.netty.handler.logging.LogLevel;
import io.netty.handler.logging.LoggingHandler;
import io.netty.handler.timeout.IdleStateHandler;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.File;
import java.util.concurrent.TimeUnit;

/**
 * 支持 WSS 的 Netty WebSocket Server
 * 访问路径示例 wss://domain.com:8090/websocket
 */
@Slf4j
@Component
public class NettyWebSocketServer {

    @Value("${netty.websocket.port:8090}")
    private int port;

    @Value("${netty.websocket.path:/websocket}")
    private String websocketPath;

    // 添加 SSL 证书资源（与你 Spring Boot 配置对应）
    @Value("classpath:certs/server.crt")
    private Resource certResource;

    @Value("classpath:certs/server.key")
    private Resource keyResource;

    @Value("${server.ssl.enabled:false}") // 默认为 false
    private boolean sslEnabled;

    private EventLoopGroup bossGroup;
    private EventLoopGroup workerGroup;
    private Channel serverChannel;

    @Autowired private JwtHelper jwtHelper;
    @Autowired private UserMapper userMapper;
    @Autowired private NettyWebSocketServerHandler webSocketServerHandler;

    @PostConstruct
    public void start() {

        log.info("启动 Netty WebSocketServer {} 监听端口:{} 支持 = WSS", websocketPath, port);

        bossGroup = new NioEventLoopGroup(1);
        workerGroup = new NioEventLoopGroup();

        try {
            // ------------------ ① 启用 SSL 让 8090 可使用 wss:// ------------------
            final SslContext sslContext;

            // 2. 加一个判断逻辑
            if (sslEnabled && certResource != null && keyResource != null) {
                // 如果开关开启，且文件存在，则加载证书
                sslContext = SslContextBuilder
                        .forServer(certResource.getFile(), keyResource.getFile())
                        .build();
                log.info("【Dev模式】WSS SSL 自签证书加载成功，Netty 将处理加密流量");
            } else {
                // 否则不使用 SSL (生产环境走这里)
                sslContext = null;
                log.info("【Prod模式】Netty SSL 已禁用 (由 Nginx 代理 SSL 或仅使用 WS)");
            }

            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .handler(new LoggingHandler(LogLevel.INFO))
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) {

                            ChannelPipeline pipeline = ch.pipeline();

                            // ② 增加 SSL Handler，核心
                            if (sslContext != null) {
                                // 注意：SSL Handler 必须添加在最前面 (addFirst)
                                pipeline.addFirst("ssl", sslContext.newHandler(ch.alloc()));
                            }

                            pipeline.addLast(new HttpServerCodec());
                            pipeline.addLast(new HttpObjectAggregator(65536));

                            pipeline.addLast(new HandshakeAuthHandler(jwtHelper, userMapper));

                            pipeline.addLast(new IdleStateHandler(60*5, 0, 10, TimeUnit.SECONDS));

                            pipeline.addLast(new WebSocketServerProtocolHandler(websocketPath, null, true, 65536));

                            pipeline.addLast(webSocketServerHandler);
                        }
                    })
                    .childOption(ChannelOption.SO_KEEPALIVE,true);

            serverChannel = bootstrap.bind(port).sync().channel();

            log.info("Netty WebSocket WSS 启动成功 🎉");
            log.info("连接地址： wss://localhost:{}{}", port, websocketPath);

        } catch (Exception e) {
            log.error("❌ Netty WebSocket 启动失败", e);
            stop();
        }
    }

    @PreDestroy
    public void stop() {
        log.info("正在关闭 Netty WebSocketServer ...");
        if (serverChannel != null) serverChannel.close();
        if (workerGroup != null) workerGroup.shutdownGracefully();
        if (bossGroup != null) bossGroup.shutdownGracefully();
        log.info("Netty WebSocketServer 已关闭");
    }
}
