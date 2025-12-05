package com.lb.controllers;

import com.lb.entity.Room;
import com.lb.message.vo.room.RoomVO;
import com.lb.service.imp.RoomService;
import com.lb.entity.UserEntity;
import com.lb.dto.resp.RoomResponse;
import jakarta.annotation.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/room")
public class RoomController {
    @Resource
    private RoomService roomService;

    @GetMapping("/create")
    public ResponseEntity<RoomVO> createRoom(@RequestParam String roomName,
                                        @RequestParam Room.GameMode gameMode,
                                        @RequestParam Integer maxPlayers){
        try {
            // 从Spring Security上下文获取当前登录用户
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户未登录");
            }

            UserEntity currentUser = (UserEntity) authentication.getPrincipal();
            Long userId = currentUser.getId();

            // 调用Service层创建房间
            RoomVO room = roomService.createRoom(userId, roomName, gameMode, maxPlayers);
            return ResponseEntity.ok(room);

        } catch (ResponseStatusException e) {
            // 重新抛出已处理的ResponseStatusException，保持原有的HTTP状态码和错误信息
            throw e;
        } catch (Exception e) {
            // 最后的异常保护，防止异常传播到框架层
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "创建房间失败，请稍后重试");
        }
    }

    /**
     * 获取所有房间列表
     * @param current 当前页码，从1开始
     * @param size 每页大小，默认10
     * @return 房间列表响应
     */
    @GetMapping("/list")
    public ResponseEntity<RoomResponse> getAllRooms(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "10") int size) {
        // 调用Service层获取房间列表
        RoomResponse response = roomService.getAllRooms(current, size);
        return ResponseEntity.ok(response);
    }

    /**
     * 获取可加入的房间列表（等待中且未满）
     * @param current 当前页码，从1开始
     * @param size 每页大小，默认10
     * @return 可加入房间列表响应
     */
    @GetMapping("/available")
    public ResponseEntity<RoomResponse> getAvailableRooms(
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "10") int size) {
        // 调用Service层获取可加入房间列表
        RoomResponse response = roomService.getAvailableRooms(current, size);
        return ResponseEntity.ok(response);
    }

}
