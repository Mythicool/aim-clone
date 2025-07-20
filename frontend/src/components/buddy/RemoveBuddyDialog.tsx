import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Buddy } from '../../types';
import './RemoveBuddyDialog.css';

interface RemoveBuddyDialogProps {
  buddy: Buddy;
  onClose: () => void;
  onBuddyRemoved?: (buddy: Buddy) => void;
}

export const RemoveBuddyDialog: React.FC<RemoveBuddyDialogProps> = ({ 
  buddy, 
  onClose, 
  onBuddyRemoved 
}) => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemoveBuddy = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/buddies/remove/${encodeURIComponent(buddy.screenName)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to remove buddy');
      }

      // Success
      if (onBuddyRemoved) {
        onBuddyRemoved(buddy);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove buddy');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="remove-buddy-dialog-overlay">
      <div className="remove-buddy-dialog">
        <div className="aim-window-header">
          <div className="aim-window-title">Remove Buddy</div>
          <div className="aim-window-controls">
            <div className="aim-window-control" onClick={onClose}>×</div>
          </div>
        </div>
        
        <div className="remove-buddy-content">
          <div className="confirmation-message">
            <div className="warning-icon">⚠️</div>
            <div className="message-text">
              <p>Are you sure you want to remove <strong>{buddy.screenName}</strong> from your buddy list?</p>
              {buddy.profile?.displayName && (
                <p className="display-name">({buddy.profile.displayName})</p>
              )}
              <p className="warning-text">
                This action cannot be undone. You will need to send a new buddy request to add them back.
              </p>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-buttons">
            <button
              className="aim-button aim-button-danger"
              onClick={handleRemoveBuddy}
              disabled={isLoading}
            >
              {isLoading ? 'Removing...' : 'Remove Buddy'}
            </button>
            <button
              className="aim-button"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveBuddyDialog;
