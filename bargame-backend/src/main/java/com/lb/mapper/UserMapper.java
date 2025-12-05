package com.lb.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;

import com.lb.entity.UserEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper extends BaseMapper<UserEntity> {

    // 自定义方法：根据邮箱查用户
    @Select("SELECT * FROM user WHERE email = #{email}")
    UserEntity findByEmail(String email);

    // 自定义方法：根据用户ID查用户（虽然BaseMapper已有，这里明确声明）
    @Select("SELECT * FROM user WHERE id = #{userId}")
    UserEntity findUserById(Long userId);
}
