import { MessageModule } from '../types/websocketMessages';
import useWebSocketStore from '../store/websocketStore';

// 在线用户类型定义
export interface OnlineUser {
  userId: number;
  username: string;
  status: string;
  location: string;
  nickName: string;
}

// 在线用户列表响应类型
export interface OnlineListResponse {
  onlineCount: number;
  onlineUsers: OnlineUser[];
}

/**
 * 大厅服务类
 * 处理大厅相关的API请求
 */
export class HallService {
  /**
   * 获取在线用户列表
   * @returns Promise<OnlineListResponse> 在线用户列表响应
   */
  static async getOnlineUsers(): Promise<OnlineListResponse> {
    const { sendMessage } = useWebSocketStore.getState();
    
    try {
      const response = await sendMessage({
        module: MessageModule.HALL,
        cmd: 'ONLINE_LIST',
        code: 200,
        msg: 'success'
      });
      
      if (response.code === 200 && response.data) {
        return response.data as OnlineListResponse;
      } else {
        throw new Error(response.msg || '获取在线用户列表失败');
      }
    } catch (error) {
      console.error('获取在线用户列表错误:', error);
      throw error;
    }
  }
}

export default HallService;