import React, { useState, useEffect } from 'react';
import { socketService } from '../../services/socket';
import { TransitionWrapper } from '../ui/SkeletonLoader';
import './OfflineBanner.css';

interface OfflineBannerProps {
  position?: 'top' | 'bottom';
  showRetryButton?: boolean;
  autoRetry?: boolean;
  retryInterval?: number;
  className?: string;
}

interface OfflineState {
  isOffline: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastAttempt: Date | null;
  nextRetryIn: number;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  position = 'top',
  showRetryButton = true,
  autoRetry = true,
  retryInterval = 5000,
  className = ''
}) => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOffline: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastAttempt: null,
    nextRetryIn: 0
  });
  const [retryTimer, setRetryTimer] = useState<NodeJS.Timeout | null>(null);
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleConnectionLost = () => {
      setOfflineState(prev => ({
        ...prev,
        isOffline: true,
        isReconnecting: false
      }));
      
      if (autoRetry) {
        scheduleRetry();
      }
    };

    const handleConnectionEstablished = () => {
      setOfflineState({
        isOffline: false,
        isReconnecting: false,
        reconnectAttempts: 0,
        lastAttempt: null,
        nextRetryIn: 0
      });
      clearRetryTimer();
    };

    const handleReconnecting = (data: { attempt: number }) => {
      setOfflineState(prev => ({
        ...prev,
        isReconnecting: true,
        reconnectAttempts: data.attempt,
        lastAttempt: new Date()
      }));
    };

    const handleReconnectFailed = () => {
      setOfflineState(prev => ({
        ...prev,
        isReconnecting: false
      }));
      
      if (autoRetry) {
        scheduleRetry();
      }
    };

    const handleOffline = () => {
      setOfflineState(prev => ({
        ...prev,
        isOffline: true,
        isReconnecting: false
      }));
      clearRetryTimer();
    };

    const handleOnline = () => {
      if (offlineState.isOffline) {
        handleRetryConnection();
      }
    };

    // Listen to socket events
    socketService.on('connection:lost', handleConnectionLost);
    socketService.on('connection:established', handleConnectionEstablished);
    socketService.on('connection:reconnecting', handleReconnecting);
    socketService.on('connection:reconnect-failed', handleReconnectFailed);

    // Listen to browser events
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      socketService.off('connection:lost', handleConnectionLost);
      socketService.off('connection:established', handleConnectionEstablished);
      socketService.off('connection:reconnecting', handleReconnecting);
      socketService.off('connection:reconnect-failed', handleReconnectFailed);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearRetryTimer();
    };
  }, [autoRetry, offlineState.isOffline]);

  const scheduleRetry = () => {
    clearRetryTimer();
    
    setOfflineState(prev => ({
      ...prev,
      nextRetryIn: retryInterval / 1000
    }));

    // Start countdown
    const countdown = setInterval(() => {
      setOfflineState(prev => {
        const newTime = prev.nextRetryIn - 1;
        if (newTime <= 0) {
          clearInterval(countdown);
          return { ...prev, nextRetryIn: 0 };
        }
        return { ...prev, nextRetryIn: newTime };
      });
    }, 1000);

    setCountdownTimer(countdown);

    // Schedule retry
    const timer = setTimeout(() => {
      handleRetryConnection();
    }, retryInterval);

    setRetryTimer(timer);
  };

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      setRetryTimer(null);
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
    setOfflineState(prev => ({ ...prev, nextRetryIn: 0 }));
  };

  const handleRetryConnection = () => {
    clearRetryTimer();
    socketService.forceReconnect();
  };

  const handleDismiss = () => {
    setOfflineState(prev => ({ ...prev, isOffline: false }));
    clearRetryTimer();
  };

  const getBannerMessage = () => {
    if (!navigator.onLine) {
      return 'No internet connection. Please check your network settings.';
    }
    
    if (offlineState.isReconnecting) {
      return `Reconnecting to AIM server... (Attempt ${offlineState.reconnectAttempts})`;
    }
    
    if (offlineState.nextRetryIn > 0) {
      return `Connection lost. Retrying in ${offlineState.nextRetryIn} seconds...`;
    }
    
    return 'Connection to AIM server lost. Some features may not work properly.';
  };

  const getBannerType = () => {
    if (!navigator.onLine) return 'error';
    if (offlineState.isReconnecting) return 'warning';
    return 'error';
  };

  if (!offlineState.isOffline) return null;

  return (
    <TransitionWrapper isVisible={offlineState.isOffline} type="slideDown">
      <div className={`offline-banner offline-banner--${position} offline-banner--${getBannerType()} ${className}`}>
        <div className="offline-banner__content">
          <div className="offline-banner__icon">
            {!navigator.onLine ? '🌐' : offlineState.isReconnecting ? '🔄' : '⚠️'}
          </div>
          
          <div className="offline-banner__message">
            {getBannerMessage()}
          </div>

          <div className="offline-banner__actions">
            {showRetryButton && !offlineState.isReconnecting && navigator.onLine && (
              <button
                className="offline-banner__button offline-banner__button--retry"
                onClick={handleRetryConnection}
                disabled={offlineState.nextRetryIn > 0}
              >
                {offlineState.nextRetryIn > 0 ? `Retry in ${offlineState.nextRetryIn}s` : 'Retry Now'}
              </button>
            )}
            
            <button
              className="offline-banner__button offline-banner__button--dismiss"
              onClick={handleDismiss}
              title="Dismiss this notification"
            >
              ✕
            </button>
          </div>
        </div>

        {offlineState.isReconnecting && (
          <div className="offline-banner__progress">
            <div className="offline-banner__progress-bar"></div>
          </div>
        )}
      </div>
    </TransitionWrapper>
  );
};

// Hook for managing offline state
export const useOfflineState = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleConnectionLost = () => {
      setIsOffline(true);
      setIsReconnecting(false);
    };

    const handleConnectionEstablished = () => {
      setIsOffline(false);
      setIsReconnecting(false);
    };

    const handleReconnecting = () => {
      setIsReconnecting(true);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsReconnecting(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
    };

    socketService.on('connection:lost', handleConnectionLost);
    socketService.on('connection:established', handleConnectionEstablished);
    socketService.on('connection:reconnecting', handleReconnecting);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      socketService.off('connection:lost', handleConnectionLost);
      socketService.off('connection:established', handleConnectionEstablished);
      socketService.off('connection:reconnecting', handleReconnecting);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return {
    isOffline,
    isReconnecting,
    retry: () => socketService.forceReconnect()
  };
};

export default OfflineBanner;
