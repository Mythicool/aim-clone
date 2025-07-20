import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { UserPreferencesProvider } from './contexts/UserPreferencesContext'
import { AuthContainer } from './components/auth'
import { BuddyList } from './components/buddy'
import { ChatWindowManager } from './components/chat'
import { SoundManager } from './components/sound/SoundManager'
import { PreferencesWindow } from './components/preferences/PreferencesWindow'
import { ProfileWindow } from './components/profile/ProfileWindow'
import { StatusManager } from './components/status/StatusManager'
import { ConnectionStatus } from './components/connection/ConnectionStatus'
import { OfflineBanner } from './components/connection/OfflineBanner'
import { PerformanceDashboard } from './components/debug/PerformanceDashboard'
import { performanceOptimizer } from './utils/performanceOptimizer'
import { socketService } from './services/socket'
import type { Buddy } from './types'
import './App.css'

function AppContent() {
  const { isAuthenticated, token } = useAuth()
  const [showPreferences, setShowPreferences] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect to socket server when authenticated
      socketService.connect(token)

      return () => {
        socketService.disconnect()
      }
    }
  }, [isAuthenticated, token])

  // Initialize performance optimization
  useEffect(() => {
    // Start performance optimization in development and production
    performanceOptimizer.updateConfig({
      enableAutoCleanup: true,
      memoryThreshold: 100, // 100MB
      messageThreshold: 1000,
      listenerThreshold: 50,
      optimizationInterval: 60000, // 1 minute
      enableLogging: import.meta.env.DEV
    });

    return () => {
      performanceOptimizer.destroy();
    };
  }, [])

  // Handle buddy double click to open chat window
  const handleBuddyDoubleClick = (buddy: Buddy) => {
    const event = new CustomEvent('openChatWindow', { detail: buddy });
    window.dispatchEvent(event);
  }
  
  // Handle preferences window open/close
  useEffect(() => {
    const handleOpenPreferences = () => {
      setShowPreferences(true);
    };

    const handleOpenProfile = () => {
      setShowProfile(true);
    };

    window.addEventListener('openPreferences', handleOpenPreferences);
    window.addEventListener('openProfile', handleOpenProfile);

    return () => {
      window.removeEventListener('openPreferences', handleOpenPreferences);
      window.removeEventListener('openProfile', handleOpenProfile);
    };
  }, []);

  if (!isAuthenticated) {
    return <AuthContainer />
  }

  return (
    <ChatWindowManager>
      <SoundManager />
      <StatusManager />
      <ConnectionStatus position="top-right" />
      <OfflineBanner position="top" />
      {import.meta.env.DEV && (
        <PerformanceDashboard
          position="bottom-right"
          enabledTools={['performance', 'memory']}
        />
      )}
      <BuddyList onBuddyDoubleClick={handleBuddyDoubleClick} />
      {showPreferences && (
        <PreferencesWindow onClose={() => setShowPreferences(false)} />
      )}
      {showProfile && (
        <ProfileWindow onClose={() => setShowProfile(false)} />
      )}
    </ChatWindowManager>
  )
}

function App() {
  return (
    <AuthProvider>
      <UserPreferencesProvider>
        <AppContent />
      </UserPreferencesProvider>
    </AuthProvider>
  )
}

export default App
