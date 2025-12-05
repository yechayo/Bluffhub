package com.lb.message.enums;

public enum ModuleType {
    HALL("大厅模块"),
    ROOM("房间模块"),
    GAME("游戏模块"),
    SYSTEM("系统模块");

    private final String desc;

    ModuleType(String desc) {
        this.desc = desc;
    }
}
