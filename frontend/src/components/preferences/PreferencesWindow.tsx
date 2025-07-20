import React, { useState } from 'react';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import './PreferencesWindow.css';

interface PreferencesWindowProps {
  onClose: () => void;
}

export const PreferencesWindow: React.FC<PreferencesWindowProps> = ({ onClose }) => {
  const { preferences, updateSoundPreference, updateNotificationPreference, updateAppearancePreference } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<'sounds' | 'notifications' | 'appearance'>('sounds');

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    updateSoundPreference('volume', volume);
  };

  const handleSoundToggle = (key: keyof typeof preferences.sounds) => {
    if (key === 'volume') return; // Skip volume as it's not a boolean
    updateSoundPreference(key, !preferences.sounds[key]);
  };

  const handleNotificationToggle = (key: keyof typeof preferences.notifications) => {
    updateNotificationPreference(key, !preferences.notifications[key]);
  };

  const handleAppearanceChange = (key: keyof typeof preferences.appearance, value: string | number) => {
    updateAppearancePreference(key, value);
  };

  return (
    <div className="preferences-window">
      <div className="window-header">
        <div className="window-title">Preferences</div>
        <button className="window-close" onClick={onClose}>X</button>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'sounds' ? 'active' : ''}`}
          onClick={() => setActiveTab('sounds')}
        >
          Sounds
        </button>
        <button
          className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
        </button>
        <button
          className={`tab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          Appearance
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'sounds' && (
          <div className="sounds-tab">
            <div className="preference-item">
              <label>
                <input 
                  type="checkbox" 
                  checked={preferences.sounds.enabled} 
                  onChange={() => handleSoundToggle('enabled')}
                />
                Enable Sounds
              </label>
            </div>
            
            <div className="preference-group">
              <div className="preference-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={preferences.sounds.buddyIn} 
                    onChange={() => handleSoundToggle('buddyIn')}
                    disabled={!preferences.sounds.enabled}
                  />
                  Buddy Online Sound
                </label>
              </div>
              
              <div className="preference-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={preferences.sounds.buddyOut} 
                    onChange={() => handleSoundToggle('buddyOut')}
                    disabled={!preferences.sounds.enabled}
                  />
                  Buddy Offline Sound
                </label>
              </div>
              
              <div className="preference-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={preferences.sounds.messageReceived} 
                    onChange={() => handleSoundToggle('messageReceived')}
                    disabled={!preferences.sounds.enabled}
                  />
                  Message Received Sound
                </label>
              </div>
              
              <div className="preference-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={preferences.sounds.messageSent} 
                    onChange={() => handleSoundToggle('messageSent')}
                    disabled={!preferences.sounds.enabled}
                  />
                  Message Sent Sound
                </label>
              </div>
              
              <div className="preference-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={preferences.sounds.doorOpening} 
                    onChange={() => handleSoundToggle('doorOpening')}
                    disabled={!preferences.sounds.enabled}
                  />
                  Door Opening Sound
                </label>
              </div>
              
              <div className="preference-item">
                <label>
                  <input 
                    type="checkbox" 
                    checked={preferences.sounds.doorClosing} 
                    onChange={() => handleSoundToggle('doorClosing')}
                    disabled={!preferences.sounds.enabled}
                  />
                  Door Closing Sound
                </label>
              </div>
            </div>
            
            <div className="preference-item volume-control">
              <label>
                Volume:
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={preferences.sounds.volume}
                  onChange={handleVolumeChange}
                  disabled={!preferences.sounds.enabled}
                />
                <span>{Math.round(preferences.sounds.volume * 100)}%</span>
              </label>
            </div>
          </div>
        )}
        
        {activeTab === 'notifications' && (
          <div className="notifications-tab">
            <div className="preference-item">
              <label>
                <input
                  type="checkbox"
                  checked={preferences.notifications.windowFlashing}
                  onChange={() => handleNotificationToggle('windowFlashing')}
                />
                Flash Window on New Messages
              </label>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="appearance-tab">
            <div className="preference-section">
              <h4>Font Settings</h4>

              <div className="preference-item">
                <label>
                  Font Family:
                  <select
                    value={preferences.appearance.fontFamily}
                    onChange={(e) => handleAppearanceChange('fontFamily', e.target.value)}
                  >
                    <option value="MS Sans Serif, sans-serif">MS Sans Serif</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Times New Roman, serif">Times New Roman</option>
                    <option value="Courier New, monospace">Courier New</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                    <option value="Georgia, serif">Georgia</option>
                  </select>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  Font Size:
                  <input
                    type="range"
                    min="8"
                    max="20"
                    value={preferences.appearance.fontSize}
                    onChange={(e) => handleAppearanceChange('fontSize', parseInt(e.target.value))}
                  />
                  <span>{preferences.appearance.fontSize}px</span>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  Font Weight:
                  <select
                    value={preferences.appearance.fontWeight}
                    onChange={(e) => handleAppearanceChange('fontWeight', e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  Font Style:
                  <select
                    value={preferences.appearance.fontStyle}
                    onChange={(e) => handleAppearanceChange('fontStyle', e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="preference-section">
              <h4>Color Settings</h4>

              <div className="preference-item">
                <label>
                  Font Color:
                  <input
                    type="color"
                    value={preferences.appearance.fontColor}
                    onChange={(e) => handleAppearanceChange('fontColor', e.target.value)}
                  />
                  <span>{preferences.appearance.fontColor}</span>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  Background Color:
                  <input
                    type="color"
                    value={preferences.appearance.backgroundColor}
                    onChange={(e) => handleAppearanceChange('backgroundColor', e.target.value)}
                  />
                  <span>{preferences.appearance.backgroundColor}</span>
                </label>
              </div>
            </div>

            <div className="preference-section">
              <h4>Layout Settings</h4>

              <div className="preference-item">
                <label>
                  Message Spacing:
                  <input
                    type="range"
                    min="1"
                    max="2"
                    step="0.1"
                    value={preferences.appearance.messageSpacing}
                    onChange={(e) => handleAppearanceChange('messageSpacing', parseFloat(e.target.value))}
                  />
                  <span>{preferences.appearance.messageSpacing.toFixed(1)}</span>
                </label>
              </div>
            </div>

            <div className="preference-section">
              <h4>Preview</h4>
              <div
                className="appearance-preview"
                style={{
                  fontFamily: preferences.appearance.fontFamily,
                  fontSize: `${preferences.appearance.fontSize}px`,
                  fontWeight: preferences.appearance.fontWeight,
                  fontStyle: preferences.appearance.fontStyle,
                  color: preferences.appearance.fontColor,
                  backgroundColor: preferences.appearance.backgroundColor,
                  lineHeight: preferences.appearance.messageSpacing,
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '2px',
                  marginTop: '8px'
                }}
              >
                <div>YourBuddy: Hey there!</div>
                <div>You: Hello! How are you doing?</div>
                <div>YourBuddy: I'm doing great, thanks for asking!</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="window-footer">
        <button className="ok-button" onClick={onClose}>OK</button>
      </div>
    </div>
  );
};

export default PreferencesWindow;