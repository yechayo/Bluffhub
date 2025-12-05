package com.lb.service.imp;

import com.lb.config.AuthConfig;
import com.lb.dto.req.UserRequestDto;
import com.lb.dto.resp.UserResponseDto;
import com.lb.entity.UserEntity;
import com.lb.exp.UserAlreadyExistsException;
import com.lb.mapper.UserMapper;
import com.lb.service.UserService;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserImp implements UserService {

    @Autowired
    private UserMapper UserMapper;

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private AuthConfig authConfig;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserEntity user = UserMapper.findByEmail(username);
        if (user == null) {
            throw new UsernameNotFoundException("用户不存在");
        }

        System.out.println("从数据库加载用户信息：");
        System.out.println("邮箱：" + user.getEmail());
        System.out.println("密码：" + user.getPassword());
        System.out.println("ID：" + user.getId());
        return user;
    }

    @Override
    public List<UserResponseDto> getAllUser() {
        List<UserEntity> userList = UserMapper.selectList(null);
        return userList.stream()
                .map(this::userEntityToUserRespDto)
                .collect(Collectors.toList());
    }

    @Override
    public UserResponseDto createUser(UserRequestDto userRequestDto) {
        UserEntity foundUser = UserMapper.findByEmail(userRequestDto.getEmail());
        if (foundUser != null) {
            throw new UserAlreadyExistsException("邮箱 " + userRequestDto.getEmail() + " 已存在");
        }

        UserEntity user = this.userReqDtoToUserEntity(userRequestDto);
        user.setPassword(authConfig.passwordEncoder().encode(user.getPassword()));
        UserMapper.insert(user);
        return this.userEntityToUserRespDto(user);
    }

    public UserEntity userReqDtoToUserEntity(UserRequestDto userReqDto) {
        return this.modelMapper.map(userReqDto, UserEntity.class);
    }

    public UserResponseDto userEntityToUserRespDto(UserEntity user) {
        return this.modelMapper.map(user, UserResponseDto.class);
    }
}
