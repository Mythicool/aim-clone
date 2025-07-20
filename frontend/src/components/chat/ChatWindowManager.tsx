import React, { useState, useCallback, useEffect } from 'react';
import type { Buddy } from '../../types';
import { ChatWindow } from './ChatWindow';

interface ChatWindowState {
  id: string;
  buddy: Buddy;
  position: { x: number; y: number };
  isActive: boolean;
}

interface ChatWindowManagerProps {
  children?: React.ReactNode;
}

export const ChatWindowManager: React.FC<ChatWindowManagerProps> = ({ children }) => {
  const [chatWindows, setChatWindows] = useState<ChatWindowState[]>([]);
  const [nextPosition, setNextPosition] = useState({ x: 300, y: 200 });

  // Open a new chat window or focus existing one
  const openChatWindow = useCallback((buddy: Buddy) => {
    setChatWindows(prev => {
      // Check if window already exists
      const existingIndex = prev.findIndex(window => window.buddy.id === buddy.id);
      
      if (existingIndex >= 0) {
        // Focus existing window
        return prev.map((window, index) => ({
          ...window,
          isActive: index === existingIndex
        }));
      } else {
        // Create new window
        const newWindow: ChatWindowState = {
          id: `chat-${buddy.id}-${Date.now()}`,
          buddy,
          position: { ...nextPosition },
          isActive: true
        };
        
        // Update next position for staggered windows
        setNextPosition(prev => ({
          x: prev.x + 30,
          y: prev.y + 30
        }));
        
        // Set all other windows as inactive and add new active window
        return [
          ...prev.map(window => ({ ...window, isActive: false })),
          newWindow
        ];
      }
    });
  }, [nextPosition]);

  // Listen for custom events to open chat windows
  useEffect(() => {
    const handleOpenChatWindow = (event: CustomEvent<Buddy>) => {
      openChatWindow(event.detail);
    };

    window.addEventListener('openChatWindow', handleOpenChatWindow as EventListener);

    return () => {
      window.removeEventListener('openChatWindow', handleOpenChatWindow as EventListener);
    };
  }, [openChatWindow]);

  // Close a chat window
  const closeChatWindow = useCallback((windowId: string) => {
    setChatWindows(prev => {
      const filtered = prev.filter(window => window.id !== windowId);
      
      // If we closed the active window, make the last remaining window active
      if (filtered.length > 0) {
        const hasActiveWindow = filtered.some(window => window.isActive);
        if (!hasActiveWindow) {
          filtered[filtered.length - 1].isActive = true;
        }
      }
      
      return filtered;
    });
  }, []);

  // Focus a specific chat window
  const focusChatWindow = useCallback((windowId: string) => {
    setChatWindows(prev => 
      prev.map(window => ({
        ...window,
        isActive: window.id === windowId
      }))
    );
  }, []);



  return (
    <>
      {children}
      
      {/* Render all chat windows */}
      {chatWindows.map(window => (
        <ChatWindow
          key={window.id}
          buddy={window.buddy}
          position={window.position}
          isActive={window.isActive}
          onClose={() => closeChatWindow(window.id)}
          onFocus={() => focusChatWindow(window.id)}
        />
      ))}
    </>
  );
};

// Hook to access chat window manager functionality
export const useChatWindowManager = () => {
  return {
    openChatWindow: (buddy: Buddy) => {
      // This will be implemented via context or event system
      // For now, we'll use a custom event
      const event = new CustomEvent('openChatWindow', { detail: buddy });
      window.dispatchEvent(event);
    }
  };
};