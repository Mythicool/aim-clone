import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserPreferences {
  sounds: {
    enabled: boolean;
    buddyIn: boolean;
    buddyOut: boolean;
    messageReceived: boolean;
    messageSent: boolean;
    doorOpening: boolean;
    doorClosing: boolean;
    volume: number; // 0 to 1
  };
  notifications: {
    windowFlashing: boolean;
  };
  appearance: {
    fontFamily: string;
    fontSize: number; // in pixels
    fontColor: string; // hex color
    backgroundColor: string; // hex color
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    messageSpacing: number; // line height multiplier
  };
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  updateSoundPreference: (key: keyof UserPreferences['sounds'], value: boolean | number) => void;
  updateNotificationPreference: (key: keyof UserPreferences['notifications'], value: boolean) => void;
  updateAppearancePreference: (key: keyof UserPreferences['appearance'], value: string | number) => void;
}

const defaultPreferences: UserPreferences = {
  sounds: {
    enabled: true,
    buddyIn: true,
    buddyOut: true,
    messageReceived: true,
    messageSent: true,
    doorOpening: true,
    doorClosing: true,
    volume: 0.5,
  },
  notifications: {
    windowFlashing: true,
  },
  appearance: {
    fontFamily: 'MS Sans Serif, sans-serif',
    fontSize: 11,
    fontColor: '#000000',
    backgroundColor: '#ffffff',
    fontWeight: 'normal',
    fontStyle: 'normal',
    messageSpacing: 1.2,
  },
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};

interface UserPreferencesProviderProps {
  children: ReactNode;
}

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    // Load preferences from localStorage if available
    const savedPreferences = localStorage.getItem('aimUserPreferences');
    return savedPreferences ? JSON.parse(savedPreferences) : defaultPreferences;
  });

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('aimUserPreferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    setPreferences(prev => ({
      ...prev,
      ...newPreferences,
    }));
  };

  const updateSoundPreference = (key: keyof UserPreferences['sounds'], value: boolean | number) => {
    setPreferences(prev => ({
      ...prev,
      sounds: {
        ...prev.sounds,
        [key]: value,
      },
    }));
  };

  const updateNotificationPreference = (key: keyof UserPreferences['notifications'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value,
      },
    }));
  };

  const updateAppearancePreference = (key: keyof UserPreferences['appearance'], value: string | number) => {
    setPreferences(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        [key]: value,
      },
    }));
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        updateSoundPreference,
        updateNotificationPreference,
        updateAppearancePreference,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};