import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserStatus } from '../../types';
import { socketService } from '../../services/socket';
import { authenticatedFetch } from '../../utils/api';
import './AwayMessageDialog.css';

interface AwayMessageDialogProps {
  onClose: () => void;
  initialMessage?: string;
  position?: { x: number; y: number };
}

export const AwayMessageDialog: React.FC<AwayMessageDialogProps> = ({
  onClose,
  initialMessage = '',
  position = { x: 200, y: 200 }
}) => {
  const { user, token } = useAuth();
  const [awayMessage, setAwayMessage] = useState(initialMessage);
  const [windowPosition, setWindowPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Handle window dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && 
        (e.target.classList.contains('aim-window-header') || 
         e.target.closest('.aim-window-header'))) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setWindowPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Set up mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle save away message
  const handleSave = async () => {
    if (!token || !user) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      // Update status via WebSocket
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('user:status-change', {
          status: UserStatus.AWAY,
          awayMessage: awayMessage.trim()
        });
      }
      
      // Also update via API for persistence
      const response = await authenticatedFetch('api/users/status', token, {
        method: 'PUT',
        body: JSON.stringify({
          status: UserStatus.AWAY,
          awayMessage: awayMessage.trim()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to set away message');
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set away message');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  return (
    <div 
      className="aim-window away-message-dialog"
      style={{ left: `${windowPosition.x}px`, top: `${windowPosition.y}px` }}
      ref={windowRef}
      onMouseDown={handleMouseDown}
    >
      <div className="aim-window-header">
        <div className="aim-window-title">
          <span>Set Away Message</span>
        </div>
        <div className="aim-window-controls">
          <div className="aim-window-control">_</div>
          <div className="aim-window-control">□</div>
          <div className="aim-window-control" onClick={handleCancel}>×</div>
        </div>
      </div>
      
      <div className="aim-window-content away-message-content">
        <div className="away-message-form">
          <div className="away-message-label">
            Enter your away message:
          </div>
          <textarea
            ref={inputRef}
            className="away-message-input"
            value={awayMessage}
            onChange={(e) => setAwayMessage(e.target.value)}
            maxLength={200}
            placeholder="I'm away from my computer right now..."
          />
          <div className="away-message-counter">
            {awayMessage.length}/200 characters
          </div>
          
          {error && (
            <div className="away-message-error">
              {error}
            </div>
          )}
          
          <div className="away-message-buttons">
            <button 
              className="aim-button aim-button-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Set Away Message'}
            </button>
            <button 
              className="aim-button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};