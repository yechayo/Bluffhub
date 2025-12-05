package com.lb.exp.handler;

import io.jsonwebtoken.ExpiredJwtException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    /**
     * 处理JWT Token过期异常
     */
    @ExceptionHandler(ExpiredJwtException.class)
    public ResponseEntity<Map<String, Object>> handleExpiredJwtException(ExpiredJwtException e) {
        // 记录简洁的日志信息，避免打印完整堆栈
        System.out.println("JWT Token已过期: " + e.getMessage());

        Map<String, Object> response = new HashMap<>();
        response.put("code", 4011);
        response.put("message", "Token已过期，请重新登录");
        response.put("data", null);
        response.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.status(401).body(response);
    }

    /**
     * 兜底异常处理器 - 捕获所有未被具体处理的异常
     * 这样可以避免遗漏任何异常处理，确保系统稳定性
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception e) {
        // 记录完整的异常信息，便于调试
        System.err.println("系统异常: " + e.getClass().getSimpleName() + " - " + e.getMessage());

        Map<String, Object> response = new HashMap<>();
        response.put("code", 5000);
        response.put("message", "系统处理异常，请稍后重试");
        response.put("data", null);
        response.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.status(500).body(response);
    }
}