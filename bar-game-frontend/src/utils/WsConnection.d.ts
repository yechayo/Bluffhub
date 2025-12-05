/**
 * WebSocket 连接管理类型声明
 */

export const WS_STATES: {
  CONNECTING: number;
  OPEN: number;
  CLOSING: number;
  CLOSED: number;
};

export declare function getWebSocket(): WebSocket | null;
export declare function getConnectionState(): number;
export declare function connectWebSocket(token: string): WebSocket | null;
export declare function disconnectWebSocket(): void;
export declare function sendMessage(message: string | object): void;