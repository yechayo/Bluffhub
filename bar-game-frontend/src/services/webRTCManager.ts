import type { WebSocketMessage, MessageModule } from '../types/websocketMessages';
import { useWebSocketStore } from '../store/websocketStore';
import { useAuthStore } from '../store/authStore';
import { StatusCode } from '../types/websocketMessages';

/**
 * WebRTC连接信息接口
 */
export interface PeerConnection {
  id: string;
  pc: RTCPeerConnection;
  audioElement: HTMLAudioElement;
}

/**
 * WebRTC信令消息类型
 */
export interface WebRTCSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

/**
 * WebRTC管理器类，负责处理音视频通话的连接和通信
 */
export class WebRTCManager {
  private localStream: MediaStream | null = null; // 本地媒体流（音频）
  private peers: Map<string, PeerConnection> = new Map(); // 存储所有对等连接
  private clientId: string | null = null; // 当前客户端ID
  private roomId: number | null = null; // 房间ID
  // 缓存在远端描述尚未设置时收到的 ICE 候选
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  // 是否已注册信令处理器
  private handlersRegistered = false;
  // private onUserJoined?: (userId: string) => void; // 用户加入回调
  // private onUserLeft?: (userId: string) => void; // 用户离开回调
  private onError?: (message: string) => void; // 错误处理回调
  private onPeerConnected?: (userId: string) => void; // 对等连接建立回调
  private onPeerDisconnected?: (userId: string) => void; // 对等连接断开回调
  private onPeersChanged?: () => void; // peers 状态变化回调

  /**
   * 构造函数
   * @param onUserJoined 用户加入回调函数
   * @param onUserLeft 用户离开回调函数
   * @param onError 错误处理回调函数
   * @param onPeerConnected 对等连接建立回调函数
   * @param onPeerDisconnected 对等连接断开回调函数
   * @param onPeersChanged peers 状态变化回调函数
   */
  constructor(
    // onUserJoined?: (userId: string) => void,
    // onUserLeft?: (userId: string) => void,
    onError?: (message: string) => void,
    onPeerConnected?: (userId: string) => void,
    onPeerDisconnected?: (userId: string) => void,
    onPeersChanged?: () => void
  ) {
    // this.onUserJoined = onUserJoined;
    // this.onUserLeft = onUserLeft;
    this.onError = onError;
    this.onPeerConnected = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;
    this.onPeersChanged = onPeersChanged;
    // 处理器延迟至 initialize 调用时注册，保证进入房间默认不开启语音
  }

  /**
   * 初始化WebRTC连接
   * @param roomId 房间ID
   * @returns 返回初始化结果
   */
  async initialize(roomId: number): Promise<boolean> {
    this.roomId = roomId;

    try {
      // 检查浏览器兼容性
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持 WebRTC 或 getUserMedia');
      }

      // 获取本地音频流，启用回声消除、噪声抑制和自动增益控制
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      // 注册WebRTC信令消息处理器
      this.registerMessageHandlers();

      // 初始化 clientId
      // alert(useAuthStore.getState().user);
      
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        this.clientId = currentUser.userId?.toString?.() || String(currentUser.userId);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          this.onError?.('麦克风权限被拒绝，请允许麦克风访问');
        } else if (error.name === 'NotFoundError') {
          this.onError?.('未找到麦克风设备，请检查设备连接');
        } else {
          this.onError?.(error.message || '无法获取麦克风权限');
        }
      } else {
        this.onError?.('无法获取麦克风权限');
      }
      throw error;
    }
  }

  /**
   * 注册WebRTC信令消息处理器
   */
  private registerMessageHandlers(): void {
    if (this.handlersRegistered) return;
    const { registerHandler } = useWebSocketStore.getState();
    
    // 注册offer消息处理器
    registerHandler({
      module: 'ROOM' as MessageModule,
      cmd: 'WEBRTC_OFFER',
      handler: this.handleOfferMessage.bind(this)
    });

    // 注册answer消息处理器
    registerHandler({
      module: 'ROOM' as MessageModule,
      cmd: 'WEBRTC_ANSWER',
      handler: this.handleAnswerMessage.bind(this)
    });

    // 注册ICE候选消息处理器
    registerHandler({
      module: 'ROOM' as MessageModule,
      cmd: 'WEBRTC_ICE_CANDIDATE',
      handler: this.handleIceCandidateMessage.bind(this)
    });
    this.handlersRegistered = true;
  }

  /**
   * 注销WebRTC信令消息处理器
   */
  private unregisterMessageHandlers(): void {
    const { unregisterHandler } = useWebSocketStore.getState();
    
    unregisterHandler('ROOM' as MessageModule, 'WEBRTC_OFFER');
    unregisterHandler('ROOM' as MessageModule, 'WEBRTC_ANSWER');
    unregisterHandler('ROOM' as MessageModule, 'WEBRTC_ICE_CANDIDATE');
    this.handlersRegistered = false;
  }

  /**
   * 处理offer消息
   */
  private async handleOfferMessage(message: WebSocketMessage): Promise<void> {
    if (!message.data) {
      console.warn('WebRTC: 收到空的 offer 数据');
      return;
    }
    
    const { from, data } = message.data;
    
    // 验证必需字段
    if (!from) {
      console.error('WebRTC: offer 消息缺少 from 字段', message.data);
      return;
    }
    
    if (!data || !data.type || !data.sdp) {
      console.error('WebRTC: offer 数据格式不正确', message.data);
      return;
    }
    
    console.log('Received offer from', from);

    // 忽略自身发出的 offer（防止服务端回环或错误路由）
    if (this.clientId && from.toString() === this.clientId.toString()) {
      console.warn('[WebRTC] 收到自身 offer，已忽略');
      return;
    }
    
    // 如果不存在连接，创建非发起方的连接
    if (!this.peers.has(from)) {
      await this.createPeerConnection(from, false);
    }

    const peer = this.peers.get(from);
    if (!peer) {
      console.error(`No peer connection found for ${from}`);
      return;
    }

    try {
      // 检查连接状态，只有在 stable 状态下才能设置 offer
      if (peer.pc.signalingState === 'stable' || peer.pc.signalingState === 'have-local-offer') {
        // Glare 处理：如果本地已经有 offer，尝试 rollback 再接受远端 offer
        if (peer.pc.signalingState === 'have-local-offer') {
          // 引入 Polite Peer 策略：通过 ID 比较打破对称性
          // 假设 ID 较小的一方为 Polite (回滚)，ID 较大的一方为 Impolite (忽略对方 Offer)
          const isPolite = this.clientId ? this.clientId < from : true;

          if (!isPolite) {
            console.warn(`[WebRTC] Glare detected. I am Impolite (${this.clientId} >= ${from}). Ignoring remote offer.`);
            return; // 忽略对方的 Offer，坚持自己的，等待对方回滚
          }

          console.log(`[WebRTC] Glare detected. I am Polite (${this.clientId} < ${from}). Rolling back local offer.`);
          try {
            await peer.pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
            console.log(`Rolled back local offer for glare resolution with ${from}`);
          } catch (e) {
            console.warn('Rollback failed, recreating peer connection as non-initiator');
            this.removePeer(from);
            await this.createPeerConnection(from, false);
          }
        }
        console.log(`Setting remote offer for ${from}, current state: ${peer.pc.signalingState}`);
        await peer.pc.setRemoteDescription(new RTCSessionDescription(data));
        console.log(`Remote offer set for ${from}, new state: ${peer.pc.signalingState}`);
        
        // 创建answer响应
        const answer = await peer.pc.createAnswer();
        console.log(`Answer created for ${from}`);
        
        await peer.pc.setLocalDescription(answer);
        console.log(`Local description set for ${from}, new state: ${peer.pc.signalingState}`);

        // 通过WebSocket发送answer
        await this.sendSignalingMessage('answer', from, answer);

        // 处理之前缓存的 ICE 候选（确保在远端描述设置后）
        const cached = this.pendingIceCandidates.get(from);
        if (cached && cached.length && peer.pc.remoteDescription) {
          console.log(`Applying ${cached.length} cached ICE candidates for ${from}`);
          for (const c of cached) {
            try { await peer.pc.addIceCandidate(new RTCIceCandidate(c)); } catch (err) { console.error('Failed to apply cached ICE candidate', err); }
          }
          this.pendingIceCandidates.delete(from);
        }
      } else {
        console.warn(`Ignoring offer from ${from} - invalid signaling state: ${peer.pc.signalingState}`);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      this.removePeer(from);
    }
  }

  /**
   * 处理answer消息
   */
  private async handleAnswerMessage(message: WebSocketMessage): Promise<void> {
    if (!message.data) {
      console.warn('WebRTC: 收到空的 answer 数据');
      return;
    }
    
    const { from, data } = message.data;
    
    // 验证必需字段
    if (!from) {
      console.error('WebRTC: answer 消息缺少 from 字段', message.data);
      return;
    }
    
    if (!data || !data.type || !data.sdp) {
      console.error('WebRTC: answer 数据格式不正确', message.data);
      return;
    }
    
    console.log('Received answer from', from);
    
    const peer = this.peers.get(from);
    if (!peer) {
      console.warn(`No peer connection found for ${from}`);
      return;
    }

    try {
      // 检查连接状态，只有在 have-local-offer 状态下才能设置 answer
      if (peer.pc.signalingState === 'have-local-offer') {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(data));
        console.log('Successfully set remote answer for', from);
        // 套用缓存的 ICE 候选（确保在远端描述设置后）
        const cached = this.pendingIceCandidates.get(from);
        if (cached && cached.length && peer.pc.remoteDescription) {
          console.log(`Applying ${cached.length} cached ICE candidates for ${from}`);
          for (const c of cached) {
            try { await peer.pc.addIceCandidate(new RTCIceCandidate(c)); } catch (err) { console.error('Failed to apply cached ICE candidate', err); }
          }
          this.pendingIceCandidates.delete(from);
        }
      } else {
        console.warn(`Ignoring answer from ${from} - invalid signaling state: ${peer.pc.signalingState}`);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  /**
   * 处理ICE候选消息
   */
  private async handleIceCandidateMessage(message: WebSocketMessage): Promise<void> {
    if (!message.data) return;
    
    const { from, data } = message.data;
    const peer = this.peers.get(from);
    if (!peer) return;

    try {
      const candidate = data as RTCIceCandidateInit;
      // 如果远端描述尚未设置，缓存候选
      if (!peer.pc.remoteDescription) {
        const list = this.pendingIceCandidates.get(from) || [];
        list.push(candidate);
        this.pendingIceCandidates.set(from, list);
        return;
      }
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  /**
   * 发送信令消息
   */
  private async sendSignalingMessage(type: 'offer' | 'answer' | 'ice-candidate', to: string, data: RTCSessionDescriptionInit | RTCIceCandidateInit): Promise<void> {
    const { sendMessage } = useWebSocketStore.getState();
    
    const cmd = type === 'offer' ? 'WEBRTC_OFFER' : 
                type === 'answer' ? 'WEBRTC_ANSWER' : 'WEBRTC_ICE_CANDIDATE';
    
    try {
      // 避免向自己发送信令
      if (this.clientId && to.toString() === this.clientId.toString()) {
        console.warn('[WebRTC] 试图向自身发送信令已阻止 type=', type);
        return;
      }
      await sendMessage({
        module: 'ROOM' as MessageModule,
        cmd,
        code: StatusCode.SUCCESS,
        msg: 'success',
        data: {
          from: this.clientId,
          to,
          data
        }
      }, { expectResponse: false }); // 不期待响应，只是发送通知
    } catch (error) {
      console.error('Failed to send signaling message:', error);
    }
  }

  /**
   * 创建与对等方的WebRTC连接
   * @param peerId 对等方ID
   * @param isInitiator 是否为连接发起方
   */
  private async createPeerConnection(peerId: string, isInitiator: boolean): Promise<void> {
    if (!this.localStream) {
      console.error('Cannot create peer connection: no local stream');
      return;
    }

    // 检查是否已存在连接
    const existingPeer = this.peers.get(peerId);
    if (existingPeer) {
      console.warn(`Peer connection for ${peerId} already exists, state: ${existingPeer.pc.signalingState}`);
      
      // 如果现有连接处于不稳定状态且当前为非发起方，则关闭旧连接并重建
      if (!isInitiator && existingPeer.pc.signalingState !== 'stable' && existingPeer.pc.signalingState !== 'have-remote-offer') {
        console.log(`Closing existing unstable connection for ${peerId} and recreating as non-initiator`);
        this.removePeer(peerId);
      } else {
        return;
      }
    }

    console.log(`Creating peer connection for ${peerId}, initiator: ${isInitiator}`);

    // 配置STUN服务器，用于NAT穿透
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    // 监听连接状态变化
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.onPeerConnected?.(peerId);
        this.onPeersChanged?.(); // 通知状态变化
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.onPeerDisconnected?.(peerId);
        this.onPeersChanged?.(); // 通知状态变化
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`Signaling state for ${peerId}:`, pc.signalingState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerId}:`, pc.iceConnectionState);
    };

    // 添加本地音频轨道到连接
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });

    // 创建音频元素用于播放远程音频
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    (audioElement as any).playsInline = true;

    // 处理接收到的远程流
    pc.ontrack = (event) => {
      console.log('Received remote stream from', peerId);
      audioElement.srcObject = event.streams[0];
    };

    // 处理ICE候选，用于NAT穿透
    pc.onicecandidate = async (event) => {
      // 关键修复：只有在远端描述已设置时才发送ICE候选
      if (event.candidate && pc.remoteDescription) {
        await this.sendSignalingMessage('ice-candidate', peerId, event.candidate);
      }
    };

    // 存储peer连接信息
    this.peers.set(peerId, {
      id: peerId,
      pc,
      audioElement
    });

    // 如果是发起方，创建并发送offer
    if (isInitiator) {
      try {
        console.log(`Creating offer for ${peerId}`);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        
        console.log(`Setting local description for ${peerId}, state: ${pc.signalingState}`);
        await pc.setLocalDescription(offer);
        console.log(`Local description set for ${peerId}, new state: ${pc.signalingState}`);

        // 通过WebSocket发送offer给对等方
        await this.sendSignalingMessage('offer', peerId, offer);
      } catch (error) {
        console.error('Error creating offer:', error);
        this.removePeer(peerId);
      }
    }
  }

  /**
   * 发起与用户的WebRTC连接
   * @param userId 目标用户ID
   */
  async connectToUser(userId: string): Promise<void> {
    // 防止对自己建立连接
    if (this.clientId && this.clientId.toString() === userId.toString()) {
      console.warn('[WebRTC] connectToUser 忽略自身 userId=', userId);
      return;
    }
    // clientId 应该已在 initialize 时设置，此处不再补救
    // 暂时始终作为发起方发送 offer，避免由于选举逻辑导致没有任意一侧发送
    // glare 由 handleOfferMessage 中的 rollback 处理
    await this.createPeerConnection(userId, true);
  }


  /**
   * 断开与用户的WebRTC连接
   * @param userId 目标用户ID
   */
  disconnectFromUser(userId: string): void {
    this.removePeer(userId);
  }

  /**
   * 移除对等连接
   * @param peerId 要移除的对等方ID
   */
  private removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      // 关闭连接并清理资源
      peer.pc.close();
      peer.audioElement.remove();
      this.peers.delete(peerId);
      this.onPeerDisconnected?.(peerId);
    }
    this.pendingIceCandidates.delete(peerId);
  }

  /**
   * 获取本地媒体流
   * @returns 本地媒体流
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * 获取所有对等连接
   * @returns 对等连接数组
   */
  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  /**
   * 获取当前客户端ID
   * @returns 客户端ID
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * 设置客户端ID
   * @param clientId 客户端ID
   */
  setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  /**
   * 获取房间ID
   * @returns 房间ID
   */
  getRoomId(): number | null {
    return this.roomId;
  }

  /**
   * 清理所有资源，关闭连接
   */
  cleanup(): void {
    // 注销消息处理器
    this.unregisterMessageHandlers();

    // 停止本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // 关闭所有peer连接
    this.peers.forEach(peer => {
      peer.pc.close();
      peer.audioElement.remove();
    });
    this.peers.clear();

    // 清空所有状态，确保下次重新初始化
    this.clientId = null;
    this.roomId = null;
    this.pendingIceCandidates.clear();
    this.handlersRegistered = false;
  }
}