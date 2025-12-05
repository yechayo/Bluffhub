import { useGameStore } from '../../store/gameStore';

/**
 * 处理后端对 PLAY_CARDS 请求的特殊响应：对手已无手牌，必须质疑而不是出牌
 * 如果检测到该响应，会清理本地临时出牌状态并抛出错误以阻止 UI 继续移除手牌
 */
export function handleMustChallengeResponse(response: any) {
  const msg: string | undefined = response && response.msg;

  if (typeof msg === 'string' && msg.includes('对手已无手牌，必须质疑而不是出牌')) {
    // 清理可能的本地临时出牌状态（保守处理）
    try {
      const { setLastPlayedAction } = useGameStore.getState();
      setLastPlayedAction(null);
    } catch (e) {
      // 忽略任何清理失败，不影响抛错行为
      console.warn('清理本地出牌状态失败', e);
    }

    // 抛出错误让调用方知道需要取消出牌
    throw new Error(msg || '对手已无手牌，必须质疑而不是出牌');
  }
}

export default {
  handleMustChallengeResponse
};
