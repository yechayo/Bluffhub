import config from '../../config/index';

/**
 * 认证相关 API 接口
 */

/**
 * 用户注册
 * @param {Object} userData - 用户注册数据
 * @param {string} userData.name - 用户名
 * @param {string} userData.email - 邮箱
 * @param {string} userData.password - 密码
 * @param {string} userData.aboutMe - 个人简介
 * @returns {Promise<Object>} 注册结果
 * @returns {string} returns.token - JWT token
 */
export const register = async (userData) => {
  try {
    const response = await fetch(`${config.baseURL}/auth/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        aboutMe: userData.aboutMe
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      token: data.token
    };
  } catch (error) {
    console.error('注册请求失败:', error);
    throw error;
  }
};