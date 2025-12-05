import { API_CONFIG } from '../config';
import { useAuthStore } from '../store/authStore';
import type { User } from '../store/authStore';

// 用户信息接口 - 直接使用 User 接口
export type UserInfoResponse = User;

/**
 * 获取用户信息
 * @param token 可选的token参数，如果不提供则从store中获取
 * @returns Promise<UserInfoResponse>
 */
export const getUserInfo = async (token?: string): Promise<UserInfoResponse> => {
  // 获取token，优先使用传入的token，否则从store中获取
  const authToken = token || useAuthStore.getState().getToken();
  
  if (!authToken) {
    throw new Error('未找到认证token');
  }

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER_INFO}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // token过期或无效，清除认证信息
        useAuthStore.getState().clearAuth();
        throw new Error('认证失败，请重新登录');
      }
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // 更新store中的用户信息
    if (data) {
      useAuthStore.getState().updateUser(data);
      console.log('用户信息已更新到 store:', data);
      console.log('store 中的 user:', useAuthStore.getState().user);
    }
    
    return data;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
};