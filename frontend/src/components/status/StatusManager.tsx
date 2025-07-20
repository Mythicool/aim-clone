import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../types';
import { socketService } from '../../services/socket';
import { AwayMessageDialog } from './AwayMessageDialog';
import './StatusManager.css';

interface StatusManagerProps {
  onStatusChange?: (status: UserStatus) => void;
}

export const StatusManager: React.FC<StatusManagerProps> = ({ onStatusChange }) => {
  const { user, token, updateUser } = useAuth();
  const [showAwayDialog, setShowAwayDialog] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [idleCheckInterval, setIdleCheckInterval] = useState<number | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  
  // Constants
  const IDLE_TIMEOUT_MINUTES = 10;
  const IDLE_CHECK_INTERVAL_MS = 60000; // Check every minute
  
  // Handle user activity
  const handleUserActivity = useCallback(() => {
    setLastActivity(new Date());
    setIsIdle(false);
    
    // If user was away due to idle and becomes active, set status back to online
    if (isIdle && user?.status === UserStatus.AWAY) {
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('user:status-change', { status: UserStatus.ONLINE });
      }
    }
  }, [isIdle, user?.status]);
  
  // Set up activity listeners
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'mousemove'];
    
    // Add throttling to avoid excessive updates
    let timeout: number | null = null;
    
    const throttledActivityHandler = () => {
      if (timeout === null) {
        timeout = window.setTimeout(() => {
          handleUserActivity();
          timeout = null;
        }, 1000); // Throttle to once per second
      }
    };
    
    activityEvents.forEach(event => {
      window.addEventListener(event, throttledActivityHandler);
    });
    
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledActivityHandler);
      });
      
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [handleUserActivity]);
  
  // Set up idle detection
  useEffect(() => {
    if (!token || !user) return;
    
    // Clear any existing interval
    if (idleCheckInterval !== null) {
      window.clearInterval(idleCheckInterval);
    }
    
    // Set up new interval
    const interval = window.setInterval(() => {
      const now = new Date();
      const idleTime = (now.getTime() - lastActivity.getTime()) / (1000 * 60); // in minutes
      
      if (idleTime >= IDLE_TIMEOUT_MINUTES && 
          user.status === UserStatus.ONLINE && 
          !isIdle) {
        setIsIdle(true);
        
        // Set status to away via WebSocket
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('user:status-change', { 
            status: UserStatus.AWAY,
            awayMessage: 'Auto-away: Idle for ' + IDLE_TIMEOUT_MINUTES + ' minutes'
          });
        }
      }
    }, IDLE_CHECK_INTERVAL_MS);
    
    setIdleCheckInterval(interval);
    
    return () => {
      window.clearInterval(interval);
    };
  }, [token, user, lastActivity, isIdle, IDLE_TIMEOUT_MINUTES]);
  
  // Handle status change
  const handleStatusChange = useCallback((status: UserStatus) => {
    if (!token || !user) return;
    
    const socket = socketService.getSocket();
    if (!socket) return;
    
    if (status === UserStatus.AWAY) {
      // Show away message dialog
      setShowAwayDialog(true);
    } else {
      // Update status directly
      socket.emit('user:status-change', { status });
      
      // Also update via API for persistence
      fetch('/api/users/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to update status');
      })
      .then(data => {
        if (updateUser) {
          updateUser(data.user);
        }
        
        if (onStatusChange) {
          onStatusChange(status);
        }
      })
      .catch(error => {
        console.error('Error updating status:', error);
      });
    }
  }, [token, user, updateUser, onStatusChange]);
  
  // Handle away dialog close
  const handleAwayDialogClose = () => {
    setShowAwayDialog(false);
  };
  
  return (
    <>
      <div className="status-manager">
        <div className="status-dropdown">
          <button className="status-button">
            <span 
              className="status-indicator" 
              style={{ 
                backgroundColor: user?.status === UserStatus.ONLINE ? '#00ff00' : 
                                user?.status === UserStatus.AWAY ? '#ffff00' : 
                                user?.status === UserStatus.INVISIBLE ? '#808080' : '#808080' 
              }}
            ></span>
            <span className="status-text">{user?.status || 'offline'}</span>
            <span className="status-arrow">▼</span>
          </button>
          
          <div className="status-dropdown-content">
            <div 
              className="status-option"
              onClick={() => handleStatusChange(UserStatus.ONLINE)}
            >
              <span className="status-indicator" style={{ backgroundColor: '#00ff00' }}></span>
              <span>Online</span>
            </div>
            <div 
              className="status-option"
              onClick={() => handleStatusChange(UserStatus.AWAY)}
            >
              <span className="status-indicator" style={{ backgroundColor: '#ffff00' }}></span>
              <span>Away</span>
            </div>
            <div 
              className="status-option"
              onClick={() => handleStatusChange(UserStatus.INVISIBLE)}
            >
              <span className="status-indicator" style={{ backgroundColor: '#808080' }}></span>
              <span>Invisible</span>
            </div>
          </div>
        </div>
      </div>
      
      {showAwayDialog && (
        <AwayMessageDialog 
          onClose={handleAwayDialogClose}
          initialMessage={user?.awayMessage || ''}
        />
      )}
    </>
  );
};