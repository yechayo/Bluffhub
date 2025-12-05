package com.lb.net;

import java.util.Map;

/**
 * WebSocket连接上下文接口
 * 抽象WebSocket连接的所有必要信息，实现对底层WebSocket实现的解耦
 *
 * @author LiarBar
 * @version 1.0
 */
public interface ConnectionContext {

    // ==================== 连接标识相关 ====================

    /**
     * 获取连接ID
     * @return 连接唯一标识符
     */
    String getId();

    /**
     * 获取用户ID
     * @return 用户ID，如果未认证则返回null
     */
    Long getUserId();

    /**
     * 设置用户ID
     * @param userId 用户ID
     */
    void setUserId(Long userId);

    // ==================== 连接状态相关 ====================

    /**
     * 检查连接是否活跃
     * @return true-连接活跃，false-连接已关闭
     */
    boolean isOpen();

    /**
     * 获取连接建立时间
     * @return 连接建立时间戳
     */
    long getConnectTime();

    /**
     * 获取最后活跃时间
     * @return 最后活跃时间戳
     */
    long getLastActiveTime();

    
    // ==================== 消息发送相关 ====================

    /**
     * 发送文本消息
     * @param message 消息内容
     * @return true-发送成功，false-发送失败
     */
    boolean sendMessage(String message);

    /**
     * 发送JSON对象消息
     * @param object Java对象，会被自动序列化为JSON
     * @return true-发送成功，false-发送失败
     */
    boolean sendJsonMessage(Object object);

    /**
     * 异步发送消息
     * @param message 消息内容
     */
    void sendMessageAsync(String message);

    /**
     * 异步发送JSON对象消息
     * @param object Java对象
     */
    void sendJsonMessageAsync(Object object);

    // ==================== 属性存储相关 ====================

    /**
     * 设置会话属性
     * @param key 属性键
     * @param value 属性值
     */
    void setAttribute(String key, Object value);

    /**
     * 获取会话属性
     * @param key 属性键
     * @return 属性值，不存在则返回null
     */
    Object getAttribute(String key);

    /**
     * 获取会话属性（带类型转换）
     * @param key 属性键
     * @param clazz 期望的类型
     * @param <T> 类型参数
     * @return 属性值，不存在或类型不匹配则返回null
     */
    <T> T getAttribute(String key, Class<T> clazz);

    /**
     * 移除会话属性
     * @param key 属性键
     * @return 被移除的属性值
     */
    Object removeAttribute(String key);

    /**
     * 获取所有属性
     * @return 属性Map的副本
     */
    Map<String, Object> getAttributes();

    // ==================== 连接管理相关 ====================

    /**
     * 关闭连接
     */
    void close();

    /**
     * 关闭连接并指定关闭原因
     * @param reason 关闭原因
     */
    void close(String reason);

    /**
     * 获取远程地址
     * @return 客户端IP地址
     */
    String getRemoteAddress();

    /**
     * 获取User-Agent信息
     * @return 客户端User-Agent
     */
    String getUserAgent();

    // ==================== 统计信息相关 ====================

    /**
     * 获取发送消息数量
     * @return 发送消息总数
     */
    long getSentMessageCount();

    /**
     * 获取接收消息数量
     * @return 接收消息总数
     */
    long getReceivedMessageCount();

    /**
     * 增加发送消息计数
     */
    void incrementSentMessageCount();

    /**
     * 增加接收消息计数
     */
    void incrementReceivedMessageCount();
}