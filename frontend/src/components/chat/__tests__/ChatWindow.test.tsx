import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatWindow } from '../ChatWindow';
import { socketService } from '../../../services/socket';
import { UserPreferencesProvider } from '../../../contexts/UserPreferencesContext';
import type { Buddy, User, UserStatus } from '../../../types';

// Mock the AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user1',
      screenName: 'TestUser',
      email: 'test@example.com',
      profile: {},
      status: 'online',
      lastSeen: new Date(),
      createdAt: new Date()
    },
    token: 'mock-token',
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    isLoading: false,
    error: null
  })
}));

// Mock the socket service
vi.mock('../../../services/socket', () => ({
  socketService: {
    getSocket: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  }
}));

// Mock fetch
global.fetch = vi.fn();

const mockUser: User = {
  id: 'user1',
  screenName: 'TestUser',
  email: 'test@example.com',
  profile: {},
  status: 'online' as UserStatus,
  lastSeen: new Date(),
  createdAt: new Date()
};

const mockBuddy: Buddy = {
  id: 'buddy1',
  screenName: 'TestBuddy',
  email: 'buddy@example.com',
  profile: {},
  status: 'online' as UserStatus,
  lastSeen: new Date(),
  createdAt: new Date(),
  relationship: {
    id: 'rel1',
    userId: 'user1',
    buddyId: 'buddy1',
    addedAt: new Date()
  }
};

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};



describe('ChatWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (socketService.getSocket as any).mockReturnValue(mockSocket);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderChatWindow = (props = {}) => {
    const defaultProps = {
      buddy: mockBuddy,
      onClose: vi.fn(),
      onFocus: vi.fn(),
      isActive: true,
      position: { x: 100, y: 100 }
    };

    return render(
      <UserPreferencesProvider>
        <ChatWindow {...defaultProps} {...props} />
      </UserPreferencesProvider>
    );
  };

  it('renders chat window with buddy name', () => {
    renderChatWindow();
    
    expect(screen.getByText(/Instant Message with TestBuddy/)).toBeInTheDocument();
  });

  it('loads conversation history on mount', async () => {
    renderChatWindow();
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/messages/conversation/buddy1',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer mock-token'
          }
        })
      );
    });
  });

  it('displays loading state initially', () => {
    renderChatWindow();
    
    expect(screen.getByText('Loading conversation...')).toBeInTheDocument();
  });

  it('displays empty state when no messages', async () => {
    renderChatWindow();
    
    await waitFor(() => {
      expect(screen.getByText('No messages yet.')).toBeInTheDocument();
      expect(screen.getByText('Start a conversation with TestBuddy!')).toBeInTheDocument();
    });
  });

  it('allows typing and sending messages', async () => {
    renderChatWindow();
    
    await waitFor(() => {
      expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Send a message to TestBuddy...');
    const sendButton = screen.getByText('Send');

    // Type a message
    fireEvent.change(input, { target: { value: 'Hello TestBuddy!' } });
    expect(input).toHaveValue('Hello TestBuddy!');

    // Send the message
    fireEvent.click(sendButton);

    expect(mockSocket.emit).toHaveBeenCalledWith('message:send', {
      toUserId: 'buddy1',
      content: 'Hello TestBuddy!'
    });

    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('sends message on Enter key press', async () => {
    renderChatWindow();
    
    await waitFor(() => {
      expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Send a message to TestBuddy...');

    // Type a message
    fireEvent.change(input, { target: { value: 'Hello via Enter!' } });

    // Press Enter
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockSocket.emit).toHaveBeenCalledWith('message:send', {
      toUserId: 'buddy1',
      content: 'Hello via Enter!'
    });
  });

  it('emits typing indicator when typing', async () => {
    renderChatWindow();
    
    await waitFor(() => {
      expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Send a message to TestBuddy...');

    // Start typing
    fireEvent.change(input, { target: { value: 'H' } });

    expect(mockSocket.emit).toHaveBeenCalledWith('conversation:typing', {
      toUserId: 'buddy1',
      isTyping: true
    });
  });

  it('stops typing indicator when input is cleared', async () => {
    renderChatWindow();
    
    await waitFor(() => {
      expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Send a message to TestBuddy...');

    // Start typing
    fireEvent.change(input, { target: { value: 'Hello' } });
    
    // Clear input
    fireEvent.change(input, { target: { value: '' } });

    expect(mockSocket.emit).toHaveBeenCalledWith('conversation:typing', {
      toUserId: 'buddy1',
      isTyping: false
    });
  });

  it('disables input when buddy is offline', () => {
    const offlineBuddy = { ...mockBuddy, status: 'offline' as UserStatus };
    renderChatWindow({ buddy: offlineBuddy });

    const input = screen.getByPlaceholderText('Send a message to TestBuddy...');
    const sendButton = screen.getByText('Send');

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('shows offline warning when buddy is offline', () => {
    const offlineBuddy = { ...mockBuddy, status: 'offline' as UserStatus };
    renderChatWindow({ buddy: offlineBuddy });

    expect(screen.getByText(/TestBuddy is offline/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderChatWindow({ onClose });

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onFocus when window is clicked', () => {
    const onFocus = vi.fn();
    renderChatWindow({ onFocus });

    const chatWindow = screen.getByText(/Instant Message with TestBuddy/).closest('.chat-window');
    fireEvent.click(chatWindow!);

    expect(onFocus).toHaveBeenCalled();
  });

  it('displays buddy status indicator', () => {
    renderChatWindow();

    const statusIndicator = screen.getByText('●');
    expect(statusIndicator).toHaveStyle({ color: '#00ff00' }); // Online color
  });

  it('handles error state when loading conversation fails', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    
    renderChatWindow();

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('sets up WebSocket event listeners', () => {
    renderChatWindow();

    expect(mockSocket.on).toHaveBeenCalledWith('message:receive', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('message:sent', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('conversation:typing', expect.any(Function));
  });

  it('cleans up WebSocket event listeners on unmount', () => {
    const { unmount } = renderChatWindow();

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('message:receive', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('message:sent', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('conversation:typing', expect.any(Function));
  });
});