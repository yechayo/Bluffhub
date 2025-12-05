package com.lb.util;

import com.lb.manager.ConnectionManager;
import com.lb.manager.GameManager;
import com.lb.manager.RoomManager;
import com.lb.manager.UserStateManager;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

/**
 * Spring上下文持有者
 * 职责：提供静态方法访问Spring管理的Bean
 * 解决循环依赖问题，特别是Player类需要访问Manager类的情况
 *
 * @author LiarBar
 * @version 1.0
 */
@Component
public class SpringContextHolder implements ApplicationContextAware {

    private static ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext context) throws BeansException {
        applicationContext = context;
    }

    /**
     * 获取ApplicationContext
     *
     * @return ApplicationContext
     */
    public static ApplicationContext getApplicationContext() {
        return applicationContext;
    }

    /**
     * 根据Bean名称获取Bean
     *
     * @param name Bean名称
     * @return Bean实例
     */
    public static Object getBean(String name) {
        return applicationContext.getBean(name);
    }

    /**
     * 根据Class获取Bean
     *
     * @param clazz Bean的Class
     * @param <T>  Bean类型
     * @return Bean实例
     */
    public static <T> T getBean(Class<T> clazz) {
        return applicationContext.getBean(clazz);
    }

    /**
     * 根据Bean名称和Class获取Bean
     *
     * @param name Bean名称
     * @param clazz Bean的Class
     * @param <T>  Bean类型
     * @return Bean实例
     */
    public static <T> T getBean(String name, Class<T> clazz) {
        return applicationContext.getBean(name, clazz);
    }

    /**
     * 获取RoomManager实例
     *
     * @return RoomManager实例
     */
    public static RoomManager getRoomManager() {
        return getBean(RoomManager.class);
    }

    public static GameManager getGameManager() {
        return getBean(GameManager.class);
    }

    public static ConnectionManager getConnectionManager() {
        return getBean(ConnectionManager.class);
    }

    /**
     * 获取UserStateManager实例
     *
     * @return UserStateManager实例
     */
    public static UserStateManager getUserStateManager() {
        return getBean(UserStateManager.class);
    }

    /**
     * 检查Spring容器是否已初始化
     *
     * @return 是否已初始化
     */
    public static boolean isInitialized() {
        return applicationContext != null;
    }
}