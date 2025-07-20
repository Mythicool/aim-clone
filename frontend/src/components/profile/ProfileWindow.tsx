import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authenticatedFetch } from '../../utils/api';
import { UserProfile } from '../../types';
import './ProfileWindow.css';

interface ProfileWindowProps {
  onClose: () => void;
}

export const ProfileWindow: React.FC<ProfileWindowProps> = ({ onClose }) => {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({
    displayName: '',
    location: '',
    interests: '',
    awayMessage: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !token) return;
      
      try {
        setIsLoading(true);
        const response = await authenticatedFetch('api/users/profile', token);

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const profileData = await response.json();
        setProfile(profileData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !token) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      const response = await authenticatedFetch('api/users/profile', token, {
        method: 'PUT',
        body: JSON.stringify(profile)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update profile');
      }

      setSuccessMessage('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="aim-window profile-window">
      <div className="aim-window-header">
        <div className="aim-window-title">My Profile</div>
        <div className="aim-window-controls">
          <div className="aim-window-control">_</div>
          <div className="aim-window-control">□</div>
          <div className="aim-window-control" onClick={onClose}>×</div>
        </div>
      </div>
      
      <div className="aim-window-content profile-content">
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
          <form onSubmit={handleSubmit} className="profile-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {successMessage && (
              <div className="success-message">
                {successMessage}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Screen Name:</label>
              <input 
                type="text" 
                className="form-input" 
                value={user?.screenName || ''} 
                disabled 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Display Name:</label>
              <input 
                type="text" 
                className="form-input" 
                name="displayName" 
                value={profile.displayName || ''} 
                onChange={handleInputChange}
                maxLength={50}
              />
              <div className="form-hint">How you want to be known to others (max 50 characters)</div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Location:</label>
              <input 
                type="text" 
                className="form-input" 
                name="location" 
                value={profile.location || ''} 
                onChange={handleInputChange}
                maxLength={100}
              />
              <div className="form-hint">Where you're from (max 100 characters)</div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Interests:</label>
              <textarea 
                className="form-textarea" 
                name="interests" 
                value={profile.interests || ''} 
                onChange={handleInputChange}
                maxLength={500}
                rows={4}
              />
              <div className="form-hint">Share your interests with others (max 500 characters)</div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Default Away Message:</label>
              <textarea 
                className="form-textarea" 
                name="awayMessage" 
                value={profile.awayMessage || ''} 
                onChange={handleInputChange}
                maxLength={200}
                rows={3}
              />
              <div className="form-hint">Message shown when you're away (max 200 characters)</div>
            </div>
            
            <div className="form-buttons">
              <button 
                type="submit" 
                className="aim-button aim-button-primary"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <button 
                type="button" 
                className="aim-button"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileWindow;