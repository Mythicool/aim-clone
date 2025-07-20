import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserPreferencesProvider, useUserPreferences } from '../UserPreferencesContext';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test component that uses the context
const TestComponent = () => {
  const { preferences, updateSoundPreference } = useUserPreferences();
  
  return (
    <div>
      <div data-testid="sound-enabled">{preferences.sounds.enabled.toString()}</div>
      <button 
        data-testid="toggle-sound"
        onClick={() => updateSoundPreference('enabled', !preferences.sounds.enabled)}
      >
        Toggle Sound
      </button>
    </div>
  );
};

describe('UserPreferencesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should provide default preferences when no saved preferences exist', () => {
    render(
      <UserPreferencesProvider>
        <TestComponent />
      </UserPreferencesProvider>
    );

    expect(screen.getByTestId('sound-enabled').textContent).toBe('true');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('aimUserPreferences');
  });

  it('should update preferences when updateSoundPreference is called', () => {
    render(
      <UserPreferencesProvider>
        <TestComponent />
      </UserPreferencesProvider>
    );

    // Initially sound is enabled
    expect(screen.getByTestId('sound-enabled').textContent).toBe('true');
    
    // Toggle sound
    fireEvent.click(screen.getByTestId('toggle-sound'));
    
    // Sound should now be disabled
    expect(screen.getByTestId('sound-enabled').textContent).toBe('false');
    
    // Preferences should be saved to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should load preferences from localStorage if available', () => {
    // Set up mock localStorage with saved preferences
    const savedPreferences = {
      sounds: {
        enabled: false,
        buddyIn: true,
        buddyOut: true,
        messageReceived: true,
        messageSent: true,
        doorOpening: true,
        doorClosing: true,
        volume: 0.7,
      },
      notifications: {
        windowFlashing: true,
      },
    };
    
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedPreferences));
    
    render(
      <UserPreferencesProvider>
        <TestComponent />
      </UserPreferencesProvider>
    );

    // Sound should be disabled as per saved preferences
    expect(screen.getByTestId('sound-enabled').textContent).toBe('false');
  });
});