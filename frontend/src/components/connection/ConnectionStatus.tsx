import React, { useState, useEffect, useCallback } from 'react';
import { socketService } from '../../services/socket';
import { TransitionWrapper } from '../ui/SkeletonLoader';
import './ConnectionStatus.css';

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  isOnline: boolean;
  lastDisconnectReason?: string;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  latency: number;
}

interface ConnectionStatusProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetails?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  position = 'top-right',
  showDetails = false,
  autoHide = true,
  autoHideDelay = 3000
}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    isOnline: navigator.onLine,
    connectionQuality: 'disconnected',
    latency: 0
  });
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hideTimer, setHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Monitor connection state
  useEffect(() => {
    const handleConnectionEstablished = () => {
      setConnectionState(prev => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        reconnectAttempts: 0,
        connectionQuality: 'excellent'
      }));
      setIsVisible(true);
      scheduleAutoHide();
    };

    const handleConnectionLost = (data: { reason?: string }) => {
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        lastDisconnectReason: data.reason,
        connectionQuality: 'disconnected'
      }));
      setIsVisible(true);
      clearAutoHide();
    };

    const handleReconnecting = (data: { attempt: number }) => {
      setConnectionState(prev => ({
        ...prev,
        isReconnecting: true,
        reconnectAttempts: data.attempt,
        connectionQuality: 'poor'
      }));
      setIsVisible(true);
      clearAutoHide();
    };

    const handleReconnectFailed = () => {
      setConnectionState(prev => ({
        ...prev,
        isReconnecting: false,
        connectionQuality: 'disconnected'
      }));
    };

    // Listen to socket service events
    socketService.on('connection:established', handleConnectionEstablished);
    socketService.on('connection:lost', handleConnectionLost);
    socketService.on('connection:reconnecting', handleReconnecting);
    socketService.on('connection:reconnect-failed', handleReconnectFailed);

    // Listen to browser online/offline events
    const handleOnline = () => {
      setConnectionState(prev => ({ ...prev, isOnline: true }));
      if (!connectionState.isConnected) {
        socketService.forceReconnect();
      }
    };

    const handleOffline = () => {
      setConnectionState(prev => ({ 
        ...prev, 
        isOnline: false,
        connectionQuality: 'disconnected'
      }));
      setIsVisible(true);
      clearAutoHide();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      socketService.off('connection:established', handleConnectionEstablished);
      socketService.off('connection:lost', handleConnectionLost);
      socketService.off('connection:reconnecting', handleReconnecting);
      socketService.off('connection:reconnect-failed', handleReconnectFailed);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearAutoHide();
    };
  }, [connectionState.isConnected]);

  // Measure connection latency
  useEffect(() => {
    if (!connectionState.isConnected) return;

    const measureLatency = () => {
      const start = performance.now();
      const socket = socketService.getSocket();
      
      if (socket) {
        socket.emit('ping', start, (response: number) => {
          const latency = performance.now() - start;
          setConnectionState(prev => ({
            ...prev,
            latency,
            connectionQuality: getConnectionQuality(latency)
          }));
        });
      }
    };

    const interval = setInterval(measureLatency, 10000); // Every 10 seconds
    measureLatency(); // Initial measurement

    return () => clearInterval(interval);
  }, [connectionState.isConnected]);

  const getConnectionQuality = (latency: number): ConnectionState['connectionQuality'] => {
    if (latency < 100) return 'excellent';
    if (latency < 300) return 'good';
    if (latency < 1000) return 'poor';
    return 'disconnected';
  };

  const scheduleAutoHide = () => {
    if (!autoHide) return;
    
    clearAutoHide();
    const timer = setTimeout(() => {
      if (connectionState.isConnected && !isExpanded) {
        setIsVisible(false);
      }
    }, autoHideDelay);
    setHideTimer(timer);
  };

  const clearAutoHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      setHideTimer(null);
    }
  };

  const handleRetryConnection = () => {
    socketService.forceReconnect();
  };

  const getStatusIcon = () => {
    if (!connectionState.isOnline) return '🌐';
    if (connectionState.isReconnecting) return '🔄';
    if (!connectionState.isConnected) return '❌';
    
    switch (connectionState.connectionQuality) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'poor': return '🟠';
      default: return '❌';
    }
  };

  const getStatusText = () => {
    if (!connectionState.isOnline) return 'No Internet Connection';
    if (connectionState.isReconnecting) return `Reconnecting... (${connectionState.reconnectAttempts})`;
    if (!connectionState.isConnected) return 'Disconnected from AIM Server';
    return 'Connected to AIM Server';
  };

  const getStatusColor = () => {
    if (!connectionState.isOnline || !connectionState.isConnected) return 'error';
    if (connectionState.isReconnecting) return 'warning';
    
    switch (connectionState.connectionQuality) {
      case 'excellent': return 'success';
      case 'good': return 'success';
      case 'poor': return 'warning';
      default: return 'error';
    }
  };

  if (!isVisible) return null;

  return (
    <TransitionWrapper isVisible={isVisible} type="slideDown">
      <div 
        className={`connection-status connection-status--${position} connection-status--${getStatusColor()}`}
        onMouseEnter={() => {
          setIsExpanded(true);
          clearAutoHide();
        }}
        onMouseLeave={() => {
          setIsExpanded(false);
          scheduleAutoHide();
        }}
      >
        <div className="connection-status__indicator">
          <span className="connection-status__icon">{getStatusIcon()}</span>
          <span className="connection-status__text">{getStatusText()}</span>
        </div>

        {(isExpanded || showDetails) && (
          <TransitionWrapper isVisible={isExpanded || showDetails} type="slideDown">
            <div className="connection-status__details">
              <div className="connection-status__detail">
                <span>Status:</span>
                <span className={`connection-status__value connection-status__value--${getStatusColor()}`}>
                  {connectionState.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {connectionState.isConnected && (
                <>
                  <div className="connection-status__detail">
                    <span>Quality:</span>
                    <span className={`connection-status__value connection-status__value--${getStatusColor()}`}>
                      {connectionState.connectionQuality}
                    </span>
                  </div>
                  <div className="connection-status__detail">
                    <span>Latency:</span>
                    <span className="connection-status__value">
                      {Math.round(connectionState.latency)}ms
                    </span>
                  </div>
                </>
              )}

              {connectionState.lastDisconnectReason && (
                <div className="connection-status__detail">
                  <span>Last Error:</span>
                  <span className="connection-status__value connection-status__value--error">
                    {connectionState.lastDisconnectReason}
                  </span>
                </div>
              )}

              {!connectionState.isConnected && connectionState.isOnline && (
                <div className="connection-status__actions">
                  <button 
                    className="connection-status__button"
                    onClick={handleRetryConnection}
                    disabled={connectionState.isReconnecting}
                  >
                    {connectionState.isReconnecting ? 'Reconnecting...' : 'Retry Connection'}
                  </button>
                </div>
              )}
            </div>
          </TransitionWrapper>
        )}
      </div>
    </TransitionWrapper>
  );
};

export default ConnectionStatus;
