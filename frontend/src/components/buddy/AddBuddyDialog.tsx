import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AddBuddyDialog.css';

interface AddBuddyDialogProps {
  onClose: () => void;
  onBuddyAdded?: (screenName: string) => void;
}

export const AddBuddyDialog: React.FC<AddBuddyDialogProps> = ({ onClose, onBuddyAdded }) => {
  const { token } = useAuth();
  const [screenName, setScreenName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!screenName.trim() || !token) return;

    try {
      setIsSearching(true);
      setError(null);
      
      // Search for users by screen name
      const response = await fetch(`/api/users/search?screenName=${encodeURIComponent(screenName.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search for users');
      }

      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search for users');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddBuddy = async (targetScreenName?: string) => {
    const buddyScreenName = targetScreenName || screenName.trim();
    
    if (!buddyScreenName || !token) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/buddies/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          screenName: buddyScreenName,
          message: message.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to add buddy');
      }

      // Success
      if (onBuddyAdded) {
        onBuddyAdded(buddyScreenName);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add buddy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddBuddy();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (screenName.trim()) {
        handleSearch();
      }
    }
  };

  return (
    <div className="add-buddy-dialog-overlay">
      <div className="add-buddy-dialog">
        <div className="aim-window-header">
          <div className="aim-window-title">Add Buddy</div>
          <div className="aim-window-controls">
            <div className="aim-window-control" onClick={onClose}>×</div>
          </div>
        </div>
        
        <div className="add-buddy-content">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Screen Name:</label>
              <div className="search-input-container">
                <input
                  type="text"
                  className="form-input"
                  value={screenName}
                  onChange={(e) => setScreenName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter screen name"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="search-button"
                  onClick={handleSearch}
                  disabled={!screenName.trim() || isSearching}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                <label className="form-label">Search Results:</label>
                <div className="results-list">
                  {searchResults.map((user) => (
                    <div key={user.id} className="result-item">
                      <div className="result-info">
                        <div className="result-screen-name">{user.screenName}</div>
                        {user.profile?.displayName && (
                          <div className="result-display-name">{user.profile.displayName}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="add-result-button"
                        onClick={() => handleAddBuddy(user.screenName)}
                        disabled={isLoading}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Message (optional):</label>
              <textarea
                className="form-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi, I'd like to add you to my buddy list!"
                rows={3}
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-buttons">
              <button
                type="submit"
                className="aim-button aim-button-primary"
                disabled={!screenName.trim() || isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Buddy'}
              </button>
              <button
                type="button"
                className="aim-button"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddBuddyDialog;
