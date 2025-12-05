package com.lb.net.netty.context;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lb.net.ConnectionContext;
import io.netty.channel.Channel;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import lombok.extern.slf4j.Slf4j;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Netty WebSocket连接上下文实现
 * 封装Netty Channel作为WebSocket连接的抽象
 *
 * @author LiarBar
 * @version 1.0
 */
@Slf4j
public class NettyConnectionContext implements ConnectionContext {

    private final String connectionId;
    private final Channel channel;
    private final long connectTime;
    private volatile long lastActiveTime;
    private Long userId;
    private final Map<String, Object> attributes;
    private final AtomicLong sentMessageCount;
    private final AtomicLong receivedMessageCount;
    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 构造函数
     * @param channel Netty Channel
     */
    public NettyConnectionContext(Channel channel) {
        this.channel = channel;
        this.connectionId = channel.id().asShortText();
        this.connectTime = System.currentTimeMillis();
        this.lastActiveTime = this.connectTime;
        this.attributes = new ConcurrentHashMap<>();
        this.sentMessageCount = new AtomicLong(0);
        this.receivedMessageCount = new AtomicLong(0);
    }

    @Override
    public String getId() {
        return connectionId;
    }

    @Override
    public Long getUserId() {
        return userId;
    }

    @Override
    public void setUserId(Long userId) {
        this.userId = userId;
    }

    @Override
    public boolean isOpen() {
        return channel != null && channel.isOpen();
    }

    @Override
    public long getConnectTime() {
        return connectTime;
    }

    @Override
    public long getLastActiveTime() {
        return lastActiveTime;
    }

    
    @Override
    public boolean sendMessage(String message) {
        try {
            if (!isOpen()) {
                log.warn("尝试向已关闭的连接发送消息: connectionId={}", connectionId);
                return false;
            }

            channel.writeAndFlush(new TextWebSocketFrame(message));
            sentMessageCount.incrementAndGet();
            return true;

        } catch (Exception e) {
            log.error("发送消息失败: connectionId={}, error={}", connectionId, e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean sendJsonMessage(Object object) {
        try {
            String jsonMessage = objectMapper.writeValueAsString(object);
            return sendMessage(jsonMessage);
        } catch (Exception e) {
            log.error("序列化JSON消息失败: connectionId={}, error={}", connectionId, e.getMessage(), e);
            return false;
        }
    }

    @Override
    public void sendMessageAsync(String message) {
        // 在Netty中，所有写操作都是异步的，所以直接调用sendMessage
        // 可以使用线程池来实现真正的异步处理
        try {
            if (!isOpen()) {
                log.warn("尝试向已关闭的连接异步发送消息: connectionId={}", connectionId);
                return;
            }

            channel.eventLoop().execute(() -> {
                try {
                    channel.writeAndFlush(new TextWebSocketFrame(message));
                    sentMessageCount.incrementAndGet();
                } catch (Exception e) {
                    log.error("异步发送消息失败: connectionId={}, error={}", connectionId, e.getMessage(), e);
                }
            });

        } catch (Exception e) {
            log.error("异步发送消息异常: connectionId={}, error={}", connectionId, e.getMessage(), e);
        }
    }

    @Override
    public void sendJsonMessageAsync(Object object) {
        try {
            String jsonMessage = objectMapper.writeValueAsString(object);
            sendMessageAsync(jsonMessage);
        } catch (Exception e) {
            log.error("异步序列化JSON消息失败: connectionId={}, error={}", connectionId, e.getMessage(), e);
        }
    }

    @Override
    public void setAttribute(String key, Object value) {
        if (key != null) {
            if (value != null) {
                attributes.put(key, value);
            } else {
                attributes.remove(key);
            }
        }
    }

    @Override
    public Object getAttribute(String key) {
        return key != null ? attributes.get(key) : null;
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T getAttribute(String key, Class<T> clazz) {
        Object value = getAttribute(key);
        if (value != null && clazz.isInstance(value)) {
            return (T) value;
        }
        return null;
    }

    @Override
    public Object removeAttribute(String key) {
        return key != null ? attributes.remove(key) : null;
    }

    @Override
    public Map<String, Object> getAttributes() {
        return new ConcurrentHashMap<>(attributes);
    }

    @Override
    public void close() {
        close("连接关闭");
    }

    @Override
    public void close(String reason) {
        try {
            if (isOpen()) {
                log.info("关闭连接: connectionId={}, reason={}", connectionId, reason);
                channel.close();
            }
        } catch (Exception e) {
            log.error("关闭连接时发生异常: connectionId={}, error={}", connectionId, e.getMessage(), e);
        }
    }

    @Override
    public String getRemoteAddress() {
        try {
            InetSocketAddress remoteAddress = (InetSocketAddress) channel.remoteAddress();
            return remoteAddress != null ? remoteAddress.getAddress().getHostAddress() : "unknown";
        } catch (Exception e) {
            log.error("获取远程地址失败: connectionId={}, error={}", connectionId, e.getMessage(), e);
            return "unknown";
        }
    }

    @Override
    public String getUserAgent() {
        // 从连接属性中获取User-Agent
        Object userAgent = getAttribute("userAgent");
        return userAgent != null ? userAgent.toString() : "unknown";
    }

    @Override
    public long getSentMessageCount() {
        return sentMessageCount.get();
    }

    @Override
    public long getReceivedMessageCount() {
        return receivedMessageCount.get();
    }

    @Override
    public void incrementSentMessageCount() {
        sentMessageCount.incrementAndGet();
    }

    @Override
    public void incrementReceivedMessageCount() {
        receivedMessageCount.incrementAndGet();
    }

    /**
     * 获取Netty Channel
     * @return Netty Channel
     */
    public Channel getChannel() {
        return channel;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        NettyConnectionContext that = (NettyConnectionContext) obj;
        return connectionId.equals(that.connectionId);
    }

    @Override
    public int hashCode() {
        return connectionId.hashCode();
    }

    @Override
    public String toString() {
        return String.format("NettyConnectionContext{connectionId='%s', userId=%d, remoteAddress='%s', isOpen=%s}",
                connectionId, userId, getRemoteAddress(), isOpen());
    }
}