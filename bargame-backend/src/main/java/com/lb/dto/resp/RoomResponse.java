package com.lb.dto.resp;


import com.lb.message.vo.room.RoomVO;
import lombok.Data;

import java.util.List;

@Data
public class RoomResponse {

    List<RoomVO> rooms;

    int size;

    int current;

    int total;
}
