package com.lb.Auth;


import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * JWT认证过滤器
 *
 * 该过滤器继承自 OncePerRequestFilter，保证每个请求只执行一次。
 * 主要职责是：
 * 1. 从请求头中解析JWT Token；
 * 2. 验证Token的有效性；
 * 3. 若验证成功，则在SecurityContext中设置认证信息，让Spring Security识别该用户为“已登录状态”。
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private Logger logger = LoggerFactory.getLogger(OncePerRequestFilter.class);

    @Autowired
    private JwtHelper jwtHelper;

    @Autowired
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 从请求头中获取 Authorization 字段
        String requestHeader = request.getHeader("Authorization");

        // 日志打印
        logger.info("收到请求头信息：{}", requestHeader);

        String username = null;
        String token = null;

        // 判断请求头是否以 "Bearer " 开头
        if (requestHeader != null && requestHeader.startsWith("Bearer")) {

            // 提取出 Token（去掉前缀 "Bearer "）
            token = requestHeader.substring(7);

            try {
                // 从 Token 中解析出用户名
                username = this.jwtHelper.getUsernameFromToken(token);

            } catch (IllegalArgumentException e) {
                logger.info("解析用户名时发生非法参数异常！");
                e.printStackTrace();
            } catch (ExpiredJwtException e) {
                logger.info("JWT Token 已过期！");
                e.printStackTrace();
            } catch (MalformedJwtException e) {
                logger.info("JWT Token 格式异常，可能被篡改！");
                e.printStackTrace();
            } catch (Exception e) {
                logger.info("解析 Token 时出现未知错误！");
                e.printStackTrace();
            }

        } else {
            logger.info("请求头中未找到有效的 Authorization 信息！");
        }

        // 当成功解析到用户名，并且当前上下文中还没有认证信息时，才进行验证
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

            // 根据用户名加载用户信息
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);

            // 验证 Token 是否有效（用户名是否匹配、是否过期等）
            Boolean validateToken = this.jwtHelper.validateToken(token, userDetails);

            if (validateToken) {
                // Token 验证成功，则在 Spring Security 上下文中设置用户认证信息
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userDetails, null, userDetails.getAuthorities());

                // 绑定请求详情（如IP、Session等）
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // 将认证对象存入 SecurityContext，让后续的 Controller 可以获取当前用户
                SecurityContextHolder.getContext().setAuthentication(authentication);

                logger.info("JWT 验证通过，已将用户 [{}] 的认证信息加入 SecurityContext。", username);

            } else {
                logger.info("JWT 验证失败，Token 无效！");
            }
        }

        // 放行请求，让其继续进入后续的过滤器或控制层
        filterChain.doFilter(request, response);
    }
}
