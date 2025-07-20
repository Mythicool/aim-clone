import { useState, useCallback, useRef, useEffect } from 'react';
import { Message } from '../types';
import { memoryManager } from '../services/memoryManager';

export interface MessageWithSender extends Message {
  senderScreenName: string;
  isFromCurrentUser: boolean;
}

interface PaginationState {
  messages: MessageWithSender[];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalMessages: number;
}

interface UseMessagePaginationOptions {
  pageSize?: number;
  initialLoad?: boolean;
  conversationId: string;
  token: string;
  currentUserId: string;
  buddyScreenName: string;
}

export const useMessagePagination = ({
  pageSize = 50,
  initialLoad = true,
  conversationId,
  token,
  currentUserId,
  buddyScreenName
}: UseMessagePaginationOptions) => {
  const [state, setState] = useState<PaginationState>({
    messages: [],
    hasMore: true,
    isLoading: false,
    error: null,
    currentPage: 0,
    totalMessages: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedMessageIds = useRef<Set<string>>(new Set());
  const conversationKey = `${conversationId}-${currentUserId}`;

  const loadMessages = useCallback(async (page: number = 0, append: boolean = false) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      const response = await fetch(
        `/api/messages/conversation/${conversationId}?page=${page}&limit=${pageSize}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      const { messages: newMessages, totalCount, hasMore } = data;

      // Transform messages to include sender information
      const messagesWithSender: MessageWithSender[] = newMessages.map((msg: Message) => ({
        ...msg,
        senderScreenName: msg.fromUserId === currentUserId ? 'You' : buddyScreenName,
        isFromCurrentUser: msg.fromUserId === currentUserId
      }));

      // Filter out duplicates
      const uniqueMessages = messagesWithSender.filter(msg => 
        !loadedMessageIds.current.has(msg.id)
      );

      // Add to loaded set
      uniqueMessages.forEach(msg => loadedMessageIds.current.add(msg.id));

      const updatedMessages = append ? [...uniqueMessages, ...state.messages] : [...state.messages, ...uniqueMessages];

      // Register with memory manager
      memoryManager.registerConversation(conversationKey, updatedMessages);

      setState(prev => ({
        ...prev,
        messages: updatedMessages,
        hasMore,
        currentPage: page,
        totalMessages: totalCount,
        isLoading: false
      }));

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }

      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load messages',
        isLoading: false
      }));
    }
  }, [conversationId, token, currentUserId, buddyScreenName, pageSize]);

  const loadMoreMessages = useCallback(() => {
    if (state.isLoading || !state.hasMore) return;
    loadMessages(state.currentPage + 1, true);
  }, [loadMessages, state.isLoading, state.hasMore, state.currentPage]);

  const addNewMessage = useCallback((message: MessageWithSender) => {
    // Avoid duplicates
    if (loadedMessageIds.current.has(message.id)) return;

    loadedMessageIds.current.add(message.id);
    setState(prev => {
      const updatedMessages = [...prev.messages, message];

      // Update memory manager
      memoryManager.updateConversation(conversationKey, [message]);

      return {
        ...prev,
        messages: updatedMessages,
        totalMessages: prev.totalMessages + 1
      };
    });
  }, [conversationKey]);

  const updateMessage = useCallback((messageId: string, updates: Partial<MessageWithSender>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  }, []);

  const clearMessages = useCallback(() => {
    loadedMessageIds.current.clear();
    setState({
      messages: [],
      hasMore: true,
      isLoading: false,
      error: null,
      currentPage: 0,
      totalMessages: 0
    });
  }, []);

  const retry = useCallback(() => {
    loadMessages(0, false);
  }, [loadMessages]);

  // Initial load
  useEffect(() => {
    if (initialLoad) {
      loadMessages(0, false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clean up memory manager references
      loadedMessageIds.current.clear();
    };
  }, [loadMessages, initialLoad]);

  return {
    messages: state.messages,
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    error: state.error,
    totalMessages: state.totalMessages,
    loadMoreMessages,
    addNewMessage,
    updateMessage,
    clearMessages,
    retry
  };
};
