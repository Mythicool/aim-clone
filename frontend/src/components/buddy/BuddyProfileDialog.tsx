import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Buddy, UserProfile } from '../../types';
import './BuddyProfileDialog.css';

interface BuddyProfileDialogProps {
  buddy: Buddy;
  onClose: () => void;
  onSendMessage?: (buddy: Buddy) => void;
}

interface ExtendedProfile extends UserProfile {
  email?: string;
  lastSeen?: Date;
  createdAt?: Date;
}

export const BuddyProfileDialog: React.FC<BuddyProfileDialogProps> = ({ 
  buddy, 
  onClose, 
  onSendMessage 
}) => {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ExtendedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBuddyProfile = async () => {
      if (!token) return;

      try {
        setIsLoading(true);
        setError(null);

        // Try to get detailed profile information
        const response = await fetch(`/api/users/profile/${encodeURIComponent(buddy.screenName)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const profileData = await response.json();
          setProfile(profileData);
        } else {
          // Fallback to buddy's basic profile info
          setProfile(buddy.profile);
        }
      } catch (err) {
        console.error('Error fetching buddy profile:', err);
        // Fallback to buddy's basic profile info
        setProfile(buddy.profile);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBuddyProfile();
  }, [buddy.screenName, token]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'away': return 'Away';
      case 'invisible': return 'Invisible';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#00ff00';
      case 'away': return '#ffff00';
      case 'invisible': return '#808080';
      case 'offline': return '#808080';
      default: return '#808080';
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Unknown';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const handleSendMessage = () => {
    if (onSendMessage) {
      onSendMessage(buddy);
    }
    onClose();
  };

  return (
    <div className="buddy-profile-dialog-overlay">
      <div className="buddy-profile-dialog">
        <div className="aim-window-header">
          <div className="aim-window-title">Buddy Info - {buddy.screenName}</div>
          <div className="aim-window-controls">
            <div className="aim-window-control" onClick={onClose}>×</div>
          </div>
        </div>
        
        <div className="buddy-profile-content">
          {isLoading ? (
            <div className="profile-loading">
              <div className="aim-loading-animation">
                <div className="aim-loading-dot"></div>
                <div className="aim-loading-dot"></div>
                <div className="aim-loading-dot"></div>
              </div>
              Loading profile...
            </div>
          ) : (
            <div className="profile-info">
              <div className="profile-header">
                <div className="screen-name-section">
                  <h3>{buddy.screenName}</h3>
                  <div className="status-indicator">
                    <span 
                      className="status-dot"
                      style={{ color: getStatusColor(buddy.status) }}
                    >
                      ●
                    </span>
                    <span className="status-text">{getStatusText(buddy.status)}</span>
                  </div>
                </div>
              </div>

              <div className="profile-details">
                {profile?.displayName && (
                  <div className="profile-field">
                    <label>Display Name:</label>
                    <span>{profile.displayName}</span>
                  </div>
                )}

                {profile?.location && (
                  <div className="profile-field">
                    <label>Location:</label>
                    <span>{profile.location}</span>
                  </div>
                )}

                {profile?.interests && (
                  <div className="profile-field">
                    <label>Interests:</label>
                    <span>{profile.interests}</span>
                  </div>
                )}

                {buddy.status === 'away' && profile?.awayMessage && (
                  <div className="profile-field away-message">
                    <label>Away Message:</label>
                    <span>{profile.awayMessage}</span>
                  </div>
                )}

                <div className="profile-field">
                  <label>Last Seen:</label>
                  <span>{formatDate(buddy.lastSeen)}</span>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="profile-actions">
                <button
                  className="aim-button aim-button-primary"
                  onClick={handleSendMessage}
                >
                  Send Message
                </button>
                <button
                  className="aim-button"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuddyProfileDialog;
