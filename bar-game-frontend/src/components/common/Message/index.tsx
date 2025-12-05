import { message as antMessage } from 'antd';
import type { ArgsProps } from 'antd/es/message';
import './index.less';

const MAC_MESSAGE_CLASS = 'mac-message';

// 辅助函数：统一参数处理
const wrapArgs = (content: any, duration?: number, onClose?: () => void): ArgsProps => {
  // 如果第一个参数是对象配置（且不是 ReactNode，虽然 ReactNode 也是对象，但这里主要判断是否为配置对象）
  // 简单的判断方式：看是否有 content 属性，或者它本身就是配置对象
  // 为了兼容 antd 的重载，我们尽量保守处理
  
  if (typeof content === 'object' && content !== null && !('type' in content) && !Array.isArray(content) && ('content' in content)) {
     // 认为是 ArgsProps
     const args = content as ArgsProps;
     return {
         ...args,
         className: `${MAC_MESSAGE_CLASS} ${args.className || ''}`.trim(),
     };
  }

  // 否则认为是 (content, duration, onClose) 形式
  return {
    content,
    duration,
    onClose,
    className: MAC_MESSAGE_CLASS,
  };
};

const message = {
  success: (content: any, duration?: number, onClose?: () => void) => antMessage.success(wrapArgs(content, duration, onClose)),
  error: (content: any, duration?: number, onClose?: () => void) => antMessage.error(wrapArgs(content, duration, onClose)),
  info: (content: any, duration?: number, onClose?: () => void) => antMessage.info(wrapArgs(content, duration, onClose)),
  warning: (content: any, duration?: number, onClose?: () => void) => antMessage.warning(wrapArgs(content, duration, onClose)),
  loading: (content: any, duration?: number, onClose?: () => void) => antMessage.loading(wrapArgs(content, duration, onClose)),
  open: (args: ArgsProps) => antMessage.open({ ...args, className: `${MAC_MESSAGE_CLASS} ${args.className || ''}`.trim() }),
  destroy: antMessage.destroy,
  useMessage: antMessage.useMessage,
  config: antMessage.config,
};

export default message;
