import { io, Socket } from 'socket.io-client';

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastDisconnectReason?: string;
  isOnline: boolean;
}

interface SocketServiceOptions {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  reconnectDelayMax?: number;
  heartbeatInterval?: number;
}

class SocketService {
  private socket: Socket | null = null;
  private readonly serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  private connectionState: ConnectionState = {
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    isOnline: navigator.onLine
  };
  private options: Required<SocketServiceOptions> = {
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
    reconnectDelayMax: 30000,
    heartbeatInterval: 30000
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(options?: SocketServiceOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  connect(token?: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(this.serverUrl, {
      auth: { token },
      autoConnect: true,
      reconnection: false, // We'll handle reconnection manually
      timeout: 10000,
      forceNew: true
    });

    this.setupSocketEventHandlers();
    return this.socket;
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to AIM server');
      this.connectionState.isConnected = true;
      this.connectionState.isReconnecting = false;
      this.connectionState.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connection:established');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from AIM server:', reason);
      this.connectionState.isConnected = false;
      this.connectionState.lastDisconnectReason = reason;
      this.stopHeartbeat();
      this.emit('connection:lost', { reason });

      // Only attempt reconnection for certain disconnect reasons
      if (this.shouldReconnect(reason)) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.emit('connection:error', { error });
      this.scheduleReconnect();
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Reconnection failed after maximum attempts');
      this.connectionState.isReconnecting = false;
      this.emit('connection:failed');
    });

    // Handle heartbeat response
    this.socket.on('heartbeat', () => {
      // Server responded to heartbeat
    });
  }

  private shouldReconnect(reason: string): boolean {
    // Don't reconnect if disconnected intentionally or due to auth issues
    const noReconnectReasons = ['io server disconnect', 'client namespace disconnect'];
    return !noReconnectReasons.includes(reason) && this.connectionState.isOnline;
  }

  private scheduleReconnect(): void {
    if (this.connectionState.isReconnecting ||
        this.connectionState.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    this.connectionState.isReconnecting = true;
    this.connectionState.reconnectAttempts++;

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1),
      this.options.reconnectDelayMax
    );

    console.log(`Scheduling reconnect attempt ${this.connectionState.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);

    this.emit('connection:reconnecting', {
      attempt: this.connectionState.reconnectAttempts,
      delay
    });
  }

  private attemptReconnect(): void {
    if (!this.connectionState.isOnline) {
      console.log('Skipping reconnect - offline');
      this.connectionState.isReconnecting = false;
      return;
    }

    console.log(`Attempting to reconnect (${this.connectionState.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    if (this.socket) {
      this.socket.connect();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleOnline(): void {
    console.log('Network came back online');
    this.connectionState.isOnline = true;
    this.emit('network:online');

    // Attempt to reconnect if we were disconnected
    if (!this.connectionState.isConnected && !this.connectionState.isReconnecting) {
      this.scheduleReconnect();
    }
  }

  private handleOffline(): void {
    console.log('Network went offline');
    this.connectionState.isOnline = false;
    this.emit('network:offline');

    // Cancel any pending reconnection attempts
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.connectionState.isReconnecting = false;
    }
  }

  // Event emitter methods
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionState.isConnected = false;
    this.connectionState.isReconnecting = false;
    this.connectionState.reconnectAttempts = 0;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.connectionState.isConnected && this.socket?.connected || false;
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  forceReconnect(): void {
    this.connectionState.reconnectAttempts = 0;
    this.disconnect();
    // Small delay before reconnecting
    setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, 100);
  }
}

export const socketService = new SocketService();