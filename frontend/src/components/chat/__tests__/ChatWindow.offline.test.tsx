import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatWindow } from '../ChatWindow';
import { AuthProvider } from '../../../contexts/AuthContext';
import { UserPreferencesProvider } from '../../../contexts/UserPreferencesContext';
import { socketService } from '../../../services/socket';
import type { Buddy } from '../../../types';

// Mock socket service
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true
};

vi.mock('../../../services/socket', () => ({
  socketService: {
    getSocket: () => mockSocket,
    connect: vi.fn(),
    disconnect: vi.fn()
  }
}));

// Mock fetch
global.fetch = vi.fn();

// Mock AuthContext
const mockUser = {
  id: '1',
  screenName: 'testuser',
  email: 'test@example.com',
  profile: {},
  status: 'online' as const,
  lastSeen: new Date(),
  createdAt: new Date()
};

const mockAuthContext = {
  user: mockUser,
  token: 'test-token',
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn()
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('ChatWindow - Offline Messaging', () => {
  const mockBuddy: Buddy = {
    id: '2',
    screenName: 'testbuddy',
    profile: {
      displayName: 'Test Buddy',
      location: 'Test City',
      interests: 'Testing',
      awayMessage: ''
    },
    status: 'offline',
    lastSeen: new Date(),
    createdAt: new Date()
  };

  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
    
    // Mock successful conversation fetch
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show offline warning when buddy is offline', async () => {
    render(
      <AuthProvider>
        <UserPreferencesProvider>
          <ChatWindow buddy={mockBuddy} onClose={onCloseMock} />
        </UserPreferencesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/testbuddy is offline/)).toBeInTheDocument();
    });
  });

  it('should disable input and send button when buddy is offline', async () => {
    render(
      <AuthProvider>
        <UserPreferencesProvider>
          <ChatWindow buddy={mockBuddy} onClose={onCloseMock} />
        </UserPreferencesProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Send a message to testbuddy/);
      const sendButton = screen.getByText('Send');
      
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });
  });

  it('should handle user offline notification', async () => {
    const onlineBuddy = { ...mockBuddy, status: 'online' as const };
    
    render(
      <AuthProvider>
        <UserPreferencesProvider>
          <ChatWindow buddy={onlineBuddy} onClose={onCloseMock} />
        </UserPreferencesProvider>
      </AuthProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message to testbuddy/)).not.toBeDisabled();
    });

    // Simulate user going offline
    const userOfflineHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'user:offline'
    )?.[1];

    if (userOfflineHandler) {
      userOfflineHandler({
        userId: mockBuddy.id,
        screenName: mockBuddy.screenName,
        awayMessage: undefined
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/testbuddy is offline/)).toBeInTheDocument();
    });
  });

  it('should handle message delivery status for offline user', async () => {
    const onlineBuddy = { ...mockBuddy, status: 'online' as const };
    
    render(
      <AuthProvider>
        <UserPreferencesProvider>
          <ChatWindow buddy={onlineBuddy} onClose={onCloseMock} />
        </UserPreferencesProvider>
      </AuthProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message to testbuddy/)).not.toBeDisabled();
    });

    // Simulate delivery status for offline recipient
    const deliveryStatusHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'message:delivery-status'
    )?.[1];

    if (deliveryStatusHandler) {
      deliveryStatusHandler({
        messageId: 'test-message-id',
        delivered: false,
        recipientOnline: false
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/Message will be delivered when they come online/)).toBeInTheDocument();
    });
  });

  it('should handle offline messages delivered notification', async () => {
    const windowDispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    
    render(
      <AuthProvider>
        <UserPreferencesProvider>
          <ChatWindow buddy={mockBuddy} onClose={onCloseMock} />
        </UserPreferencesProvider>
      </AuthProvider>
    );

    // Simulate offline messages delivered
    const offlineMessagesHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'offline-messages:delivered'
    )?.[1];

    if (offlineMessagesHandler) {
      offlineMessagesHandler({
        count: 3,
        messages: [
          { id: '1', content: 'Message 1' },
          { id: '2', content: 'Message 2' },
          { id: '3', content: 'Message 3' }
        ]
      });
    }

    expect(windowDispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'showNotification',
        detail: {
          message: '3 offline message(s) delivered',
          type: 'info'
        }
      })
    );

    windowDispatchEventSpy.mockRestore();
  });

  it('should show delivery status indicators', async () => {
    const onlineBuddy = { ...mockBuddy, status: 'online' as const };
    
    render(
      <AuthProvider>
        <UserPreferencesProvider>
          <ChatWindow buddy={onlineBuddy} onClose={onCloseMock} />
        </UserPreferencesProvider>
      </AuthProvider>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Send a message to testbuddy/)).not.toBeDisabled();
    });

    // Simulate failed delivery
    const deliveryStatusHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'message:delivery-status'
    )?.[1];

    if (deliveryStatusHandler) {
      deliveryStatusHandler({
        messageId: 'test-message-id',
        delivered: false,
        recipientOnline: true
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/Failed to deliver/)).toBeInTheDocument();
      expect(screen.getByTitle('Retry sending message')).toBeInTheDocument();
    });
  });

  it('should handle message receive with offline message flag', async () => {
    render(
      <AuthProvider>
        <UserPreferencesProvider>
          <ChatWindow buddy={mockBuddy} onClose={onCloseMock} />
        </UserPreferencesProvider>
      </AuthProvider>
    );

    // Simulate receiving an offline message
    const messageReceiveHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'message:receive'
    )?.[1];

    if (messageReceiveHandler) {
      messageReceiveHandler({
        message: {
          id: 'offline-msg-1',
          fromUserId: mockBuddy.id,
          toUserId: mockUser.id,
          content: 'This is an offline message',
          timestamp: new Date(),
          isRead: false,
          isDelivered: true
        },
        from: {
          id: mockBuddy.id,
          screenName: mockBuddy.screenName
        },
        isOfflineMessage: true
      });
    }

    await waitFor(() => {
      expect(screen.getByText('This is an offline message')).toBeInTheDocument();
    });
  });
});
