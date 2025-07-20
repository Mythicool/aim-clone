import React, { useState, useEffect } from 'react';
import { socketService } from '../../services/socket';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  className?: string;
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'offline';

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Initial status
    if (socketService.isConnected()) {
      setStatus('connected');
    }

    // Socket event listeners
    const handleConnectionEstablished = () => {
      setStatus('connected');
      setReconnectAttempt(0);
    };

    const handleConnectionLost = () => {
      setStatus('disconnected');
    };

    const handleConnectionError = () => {
      setStatus('disconnected');
    };

    const handleReconnecting = (data: { attempt: number }) => {
      setStatus('reconnecting');
      setReconnectAttempt(data.attempt);
    };

    const handleConnectionFailed = () => {
      setStatus('disconnected');
    };

    const handleNetworkOnline = () => {
      setIsOnline(true);
      if (status === 'offline') {
        setStatus('connecting');
      }
    };

    const handleNetworkOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    // Register listeners
    socketService.on('connection:established', handleConnectionEstablished);
    socketService.on('connection:lost', handleConnectionLost);
    socketService.on('connection:error', handleConnectionError);
    socketService.on('connection:reconnecting', handleReconnecting);
    socketService.on('connection:failed', handleConnectionFailed);
    socketService.on('network:online', handleNetworkOnline);
    socketService.on('network:offline', handleNetworkOffline);

    // Cleanup
    return () => {
      socketService.off('connection:established', handleConnectionEstablished);
      socketService.off('connection:lost', handleConnectionLost);
      socketService.off('connection:error', handleConnectionError);
      socketService.off('connection:reconnecting', handleReconnecting);
      socketService.off('connection:failed', handleConnectionFailed);
      socketService.off('network:online', handleNetworkOnline);
      socketService.off('network:offline', handleNetworkOffline);
    };
  }, [status]);

  const getStatusText = (): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'reconnecting':
        return `Reconnecting... (${reconnectAttempt})`;
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = (): string => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
      case 'reconnecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
      case 'offline':
        return '⚫';
      default:
        return '❓';
    }
  };

  const handleRetryConnection = () => {
    if (status === 'disconnected' || status === 'offline') {
      setStatus('connecting');
      socketService.forceReconnect();
    }
  };

  const showRetryButton = status === 'disconnected' && isOnline;

  return (
    <div className={`connection-status ${status} ${className}`}>
      <div className="connection-indicator">
        <span className="status-icon" title={getStatusText()}>
          {getStatusIcon()}
        </span>
        <span className="status-text">{getStatusText()}</span>
      </div>
      
      {showRetryButton && (
        <button 
          className="retry-button"
          onClick={handleRetryConnection}
          title="Retry connection"
        >
          🔄
        </button>
      )}
      
      {!isOnline && (
        <div className="offline-warning">
          <span>⚠️ No internet connection</span>
        </div>
      )}
    </div>
  );
};
