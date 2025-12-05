import type { SystemReconnectPayload } from '../types/websocketMessages';

export type ReconnectRouteTarget =
  | { type: 'game'; roomId: number; gameId: number }
  | { type: 'room'; roomId: number }
  | { type: 'lobby' };

let routeCallback: ((target: ReconnectRouteTarget) => void) | null = null;

export const registerReconnectRouteCallback = (cb: (t: ReconnectRouteTarget) => void): void => {
  routeCallback = cb;
};

export const unregisterReconnectRouteCallback = (): void => {
  routeCallback = null;
};

export const emitReconnectRouteTarget = (payload: SystemReconnectPayload): void => {
  if (!routeCallback) return;
  if (payload.gameId != null && payload.roomId != null) {
    routeCallback({ type: 'game', roomId: payload.roomId, gameId: payload.gameId });
  } else if (payload.roomId != null) {
    routeCallback({ type: 'room', roomId: payload.roomId });
  } else {
    routeCallback({ type: 'lobby' });
  }
};

export const handleReconnectRouteTarget = (target: ReconnectRouteTarget, currentPath: string): string | null => {
  if (target.type === 'game') {
    return `/room/${target.roomId}/Gaming`;
  }
  if (target.type === 'room') {
    // 如果当前就在该房间路由上则不变
    if (currentPath.startsWith(`/room/${target.roomId}`)) return null;
    return `/room/${target.roomId}`;
  }
  // lobby
  if (currentPath === '/' || currentPath === '/gamebar') return null;
  return '/gamebar';
};
