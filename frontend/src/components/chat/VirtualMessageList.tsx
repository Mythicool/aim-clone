import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageWithSender } from '../../hooks/useMessagePagination';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';

interface VirtualMessageListProps {
  messages: MessageWithSender[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  containerHeight: number;
  itemHeight?: number;
  overscan?: number;
  className?: string;
}

interface MessageItemProps {
  message: MessageWithSender;
  style: React.CSSProperties;
  formatTimestamp: (timestamp: Date) => string;
  preferences: any;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(({ 
  message, 
  style, 
  formatTimestamp, 
  preferences 
}) => (
  <div 
    style={style}
    className={`chat-message ${message.isFromCurrentUser ? 'outgoing' : 'incoming'} ${
      message.content.startsWith('[AUTO-RESPONSE]') ? 'auto-response' : ''
    }`}
  >
    <div className="message-header">
      <span className="message-sender" data-testid="message-sender">
        {message.senderScreenName}
      </span>
      <span className="message-timestamp" data-testid="message-timestamp">
        {formatTimestamp(message.timestamp)}
      </span>
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
));

MessageItem.displayName = 'MessageItem';

export const VirtualMessageList: React.FC<VirtualMessageListProps> = ({
  messages,
  hasMore,
  isLoading,
  onLoadMore,
  containerHeight,
  itemHeight = 80,
  overscan = 5,
  className = ''
}) => {
  const { preferences } = useUserPreferences();
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const end = Math.min(messages.length, start + visibleCount);
    
    return { start, end };
  }, [scrollTop, containerHeight, itemHeight, overscan, messages.length]);

  // Get visible messages
  const visibleMessages = useMemo(() => {
    return messages.slice(visibleRange.start, visibleRange.end);
  }, [messages, visibleRange]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    const maxScrollTop = target.scrollHeight - target.clientHeight;
    
    setScrollTop(newScrollTop);
    
    // Check if scrolled to bottom (with small tolerance)
    const isAtBottom = Math.abs(maxScrollTop - newScrollTop) < 10;
    setIsScrolledToBottom(isAtBottom);

    // Load more messages when scrolled to top
    if (newScrollTop < itemHeight && hasMore && !isLoading) {
      onLoadMore();
    }

    // Debounce scroll events for performance
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      // Additional scroll handling if needed
    }, 100);
  }, [hasMore, isLoading, onLoadMore, itemHeight]);

  // Auto-scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (isScrolledToBottom && containerRef.current) {
      const container = containerRef.current;
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }
  }, [messages.length, isScrolledToBottom]);

  // Scroll to bottom initially
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      const container = containerRef.current;
      container.scrollTop = container.scrollHeight - container.clientHeight;
    }
  }, [messages.length > 0]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const totalHeight = messages.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div 
      ref={containerRef}
      className={`virtual-message-list ${className}`}
      style={{ 
        height: containerHeight, 
        overflowY: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      {/* Loading indicator at top */}
      {isLoading && hasMore && (
        <div className="message-loading-top">
          <div className="aim-loading-animation">
            <div className="aim-loading-dot"></div>
            <div className="aim-loading-dot"></div>
            <div className="aim-loading-dot"></div>
          </div>
          Loading more messages...
        </div>
      )}

      {/* Virtual container */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleMessages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              style={{
                position: 'absolute',
                top: (visibleRange.start + index) * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
              formatTimestamp={formatTimestamp}
              preferences={preferences}
            />
          ))}
        </div>
      </div>

      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <div className="chat-empty">
          <p>No messages yet.</p>
          <p>Start a conversation!</p>
        </div>
      )}

      {/* Scroll to bottom button */}
      {!isScrolledToBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={() => {
            if (containerRef.current) {
              const container = containerRef.current;
              container.scrollTop = container.scrollHeight - container.clientHeight;
            }
          }}
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}
    </div>
  );
};
