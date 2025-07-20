import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, Buddy } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { socketService } from '../../services/socket';
import { retryService } from '../../services/retryService';
import { useMessagePagination, type MessageWithSender } from '../../hooks/useMessagePagination';
import { useOptimizedSocket } from '../../hooks/useOptimizedSocket';
import { memoryManager } from '../../services/memoryManager';
import { VirtualMessageList } from './VirtualMessageList';
import { MessageSkeleton, LoadingOverlay, TransitionWrapper } from '../ui/SkeletonLoader';
import { startWindowFlashing, stopWindowFlashing, isWindowFocused } from '../../utils/windowNotifications';
import './ChatWindow.css';

interface ChatWindowProps {
  buddy: Buddy;
  onClose?: () => void;
  onFocus?: () => void;
  isActive?: boolean;
  position?: { x: number; y: number };
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  buddy,
  onClose,
  onFocus,
  isActive = true,
  position = { x: 300, y: 200 }
}) => {
  const { user, token } = useAuth();
  const { preferences } = useUserPreferences();

  // Use pagination hook for message management
  const {
    messages,
    hasMore,
    isLoading,
    error,
    loadMoreMessages,
    addNewMessage,
    updateMessage,
    retry
  } = useMessagePagination({
    conversationId: buddy.id,
    token: token || '',
    currentUserId: user?.id || '',
    buddyScreenName: buddy.screenName,
    pageSize: 50
  });

  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [buddyTyping, setBuddyTyping] = useState(false);
  const [windowPosition, setWindowPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<{[messageId: string]: 'sending' | 'delivered' | 'failed'}>({});
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Note: Conversation history loading is now handled by useMessagePagination hook

  // Handle incoming messages
  const handleMessageReceive = useCallback((data: {
    message: Message;
    from: { id: string; screenName: string };
    isAutoResponse?: boolean;
  }) => {
    // Only handle messages from this buddy
    if (data.from.id === buddy.id) {
      const messageWithSender: MessageWithSender = {
        ...data.message,
        senderScreenName: data.from.screenName,
        isFromCurrentUser: false
      };

      addNewMessage(messageWithSender);

      // Mark as unread if window is not active and it's not an auto-response
      if (!isWindowFocused() && !data.isAutoResponse) {
        startWindowFlashing(`New message from ${buddy.screenName}`);

        // Trigger message received sound event
        const messageReceivedEvent = new CustomEvent('messageReceived', {
          detail: { fromUserId: buddy.id, screenName: buddy.screenName }
        });
        window.dispatchEvent(messageReceivedEvent);
      }
    }
  }, [buddy.id, buddy.screenName, addNewMessage]);

  // Handle message sent confirmation
  const handleMessageSent = useCallback((data: { message: Message }) => {
    // Only handle messages to this buddy
    if (data.message.toUserId === buddy.id) {
      const messageWithSender: MessageWithSender = {
        ...data.message,
        senderScreenName: user?.screenName || '',
        isFromCurrentUser: true
      };

      addNewMessage(messageWithSender);
    }
  }, [buddy.id, user?.screenName, addNewMessage]);

  // Handle typing indicator
  const handleTypingIndicator = useCallback((data: {
    fromUserId: string;
    isTyping: boolean;
    screenName: string
  }) => {
    if (data.fromUserId === buddy.id) {
      setIsTyping(data.isTyping);

      if (data.isTyping) {
        // Clear any existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to clear typing indicator
        typingTimeoutRef.current = window.setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    }
  }, [buddy.id]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  // Handle sending a message
  const handleSendMessage = useCallback(() => {
    if (!currentMessage.trim() || !user) return;

    const socket = socketService.getSocket();
    if (!socket) {
      console.error('Not connected to server');
      return;
    }

    const messageContent = currentMessage.trim();

    // Generate temporary message ID for tracking
    const tempMessageId = `temp_${Date.now()}_${Math.random()}`;

    // Mark message as sending
    setDeliveryStatus(prev => ({
      ...prev,
      [tempMessageId]: 'sending'
    }));

    // Send message via WebSocket
    socket.emit('message:send', {
      toUserId: buddy.id,
      content: messageContent,
      tempId: tempMessageId
    });

    // Clear input
    setCurrentMessage('');

    // Stop typing indicator
    if (isTyping) {
      socket.emit('conversation:typing', {
        toUserId: buddy.id,
        isTyping: false
      });
      setIsTyping(false);
    }

    // Clear any previous offline warnings
    setOfflineWarning(null);

    // Trigger message sent sound event
    const messageSentEvent = new CustomEvent('messageSent');
    window.dispatchEvent(messageSentEvent);
  }, [currentMessage, user, buddy.id, isTyping]);

  // Handle input change and typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentMessage(value);

    const socket = socketService.getSocket();
    if (!socket) return;

    // Handle typing indicator
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      socket.emit('conversation:typing', {
        toUserId: buddy.id,
        isTyping: true
      });
    } else if (!value.trim() && isTyping) {
      setIsTyping(false);
      socket.emit('conversation:typing', {
        toUserId: buddy.id,
        isTyping: false
      });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = window.setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socket.emit('conversation:typing', {
          toUserId: buddy.id,
          isTyping: false
        });
      }
    }, 3000);
  }, [buddy.id, isTyping]);

  // Handle key press (Enter to send)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle window focus
  const handleWindowFocus = useCallback(() => {
    if (onFocus) {
      onFocus();
    }
    
    // Mark messages as read when window is focused
    if (hasUnreadMessages && user) {
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('message:read', { fromUserId: buddy.id });
        setHasUnreadMessages(false);
        
        // Stop window flashing when window is focused
        stopWindowFlashing();
      }
    }
    
    // Focus input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onFocus, hasUnreadMessages, user, buddy.id]);

  // Handle window dragging
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setWindowPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Set up WebSocket listeners
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !user) return;



    // Simplified handlers for events we don't fully implement yet
    const handleDeliveryStatus = (data: any) => {
      console.log('Message delivery status:', data);
    };

    const handleUserOffline = (data: any) => {
      console.log('User offline:', data);
    };

    const handleOfflineMessagesDelivered = (data: any) => {
      console.log('Offline messages delivered:', data);
    };

    socket.on('message:receive', handleMessageReceive);
    socket.on('message:sent', handleMessageSent);
    socket.on('conversation:typing', handleTypingIndicator);
    socket.on('message:delivery-status', handleDeliveryStatus);
    socket.on('user:offline', handleUserOffline);
    socket.on('offline-messages:delivered', handleOfflineMessagesDelivered);

    return () => {
      socket.off('message:receive', handleMessageReceive);
      socket.off('message:sent', handleMessageSent);
      socket.off('conversation:typing', handleTypingIndicator);
      socket.off('message:delivery-status', handleDeliveryStatus);
      socket.off('user:offline', handleUserOffline);
      socket.off('offline-messages:delivered', handleOfflineMessagesDelivered);
    };
  }, [user, buddy.id, buddy.screenName, handleMessageReceive, handleMessageSent, handleTypingIndicator]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when window becomes active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Cleanup typing timeout on unmount and register with memory manager
  useEffect(() => {
    // Register event listeners with memory manager
    memoryManager.registerEventListener('ChatWindow', 'message:receive', handleMessageReceive);
    memoryManager.registerEventListener('ChatWindow', 'message:sent', handleMessageSent);
    memoryManager.registerEventListener('ChatWindow', 'conversation:typing', handleTypingIndicator);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Unregister event listeners
      memoryManager.unregisterEventListener('ChatWindow', 'message:receive', handleMessageReceive);
      memoryManager.unregisterEventListener('ChatWindow', 'message:sent', handleMessageSent);
      memoryManager.unregisterEventListener('ChatWindow', 'conversation:typing', handleTypingIndicator);
    };
  }, [handleMessageReceive, handleMessageSent, handleTypingIndicator]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`aim-window chat-window ${isActive ? 'active' : ''} ${hasUnreadMessages ? 'has-unread' : ''}`}
      style={{ left: `${windowPosition.x}px`, top: `${windowPosition.y}px` }}
      ref={windowRef}
      onMouseDown={handleMouseDown}
      onClick={handleWindowFocus}
    >
      <div className="aim-window-header">
        <div className="aim-window-title">
          <span className={`aim-status-icon ${buddy.status.toLowerCase()}`} title={buddy.status}>
          </span>
          <span>Instant Message with {buddy.screenName}</span>
        </div>
        <div className="aim-window-controls">
          <div className="aim-window-control">_</div>
          <div className="aim-window-control">□</div>
          <div className="aim-window-control" onClick={onClose}>×</div>
        </div>
      </div>
      
      <div className="aim-window-content chat-content">
        <div
          className="chat-messages"
          ref={messagesRef}
          style={{
            fontFamily: preferences.appearance.fontFamily,
            fontSize: `${preferences.appearance.fontSize}px`,
            color: preferences.appearance.fontColor,
            backgroundColor: preferences.appearance.backgroundColor,
            lineHeight: preferences.appearance.messageSpacing,
          }}
        >
          {isLoading ? (
            <TransitionWrapper isVisible={isLoading} type="fade">
              <MessageSkeleton count={5} />
            </TransitionWrapper>
          ) : error ? (
            <div className="chat-error">
              Error: {error}
              <button className="aim-button" onClick={retry}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <p>No messages yet.</p>
                  <p>Start a conversation with {buddy.screenName}!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`chat-message ${message.isFromCurrentUser ? 'outgoing' : 'incoming'} ${
                      message.content.startsWith('[AUTO-RESPONSE]') ? 'auto-response' : ''
                    }`}
                  >
                    <div className="message-header">
                      <span className="message-sender">{message.senderScreenName}</span>
                      <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div
                      className="message-content"
                      style={{
                        fontWeight: preferences.appearance.fontWeight,
                        fontStyle: preferences.appearance.fontStyle,
                      }}
                    >
                      {message.content.startsWith('[AUTO-RESPONSE]')
                        ? message.content.replace('[AUTO-RESPONSE]', '').trim()
                        : message.content}
                    </div>
                  </div>
                ))
              )}
              
              {buddyTyping && (
                <div className="typing-indicator">
                  <span className="typing-text">{buddy.screenName} is typing</span>
                  <div className="typing-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="chat-input-container">
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={`Send a message to ${buddy.screenName}...`}
            value={currentMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={buddy.status === 'offline'}
          />
          <button 
            className="chat-send-button aim-button"
            onClick={handleSendMessage}
            disabled={!currentMessage.trim() || buddy.status === 'offline'}
          >
            Send
          </button>
        </div>
        
        {(buddy.status === 'offline' || offlineWarning) && (
          <div className="chat-offline-warning">
            {offlineWarning || `${buddy.screenName} is offline. Messages will be delivered when they come online.`}
          </div>
        )}

        {Object.keys(deliveryStatus).length > 0 && (
          <div className="chat-delivery-status">
            {Object.entries(deliveryStatus).map(([messageId, status]) => (
              <div key={messageId} className={`delivery-indicator ${status}`}>
                {status === 'sending' && '⏳ Sending...'}
                {status === 'delivered' && '✓ Delivered'}
                {status === 'failed' && (
                  <span>
                    ✗ Failed to deliver
                    <button
                      className="retry-button"
                      onClick={() => retryService.retryOperation(`retry_message_${messageId}`)}
                      title="Retry sending message"
                    >
                      ↻
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {buddy.status === 'away' && buddy.profile.awayMessage && (
          <div className="chat-away-message">
            <div className="away-message-header">Away Message:</div>
            <div className="away-message-content">{buddy.profile.awayMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
};