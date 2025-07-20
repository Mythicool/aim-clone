import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BuddyList } from '../BuddyList';
import { AuthProvider } from '../../../contexts/AuthContext';
import { socketService } from '../../../services/socket';
import { UserStatus } from '../../../types';

// Mock the socket service
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true
};

vi.mock('../../../services/socket', () => ({
  socketService: {
    connect: vi.fn(() => mockSocket),
    disconnect: vi.fn(),
    getSocket: vi.fn(() => mockSocket),
    isConnected: vi.fn(() => true)
  }
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock image import
vi.mock('../../../assets/aim-logo-small.png', () => 'aim-logo-mock.png');

describe('BuddyList Component', () => {
  const mockUser = {
    id: 'user1',
    screenName: 'TestUser',
    email: 'test@example.com',
    profile: { displayName: 'Test User', awayMessage: '' },
    status: 'online' as UserStatus,
    lastSeen: new Date(),
    createdAt: new Date()
  };
  
  const mockBuddies = [
    {
      id: 'buddy1',
      screenName: 'Friend1',
      email: 'friend1@example.com',
      profile: { displayName: 'Friend One', awayMessage: '' },
      status: 'online' as UserStatus,
      lastSeen: new Date(),
      createdAt: new Date(),
      relationship: {
        id: 'rel1',
        userId: 'user1',
        buddyId: 'buddy1',
        groupName: 'Friends',
        addedAt: new Date()
      }
    },
    {
      id: 'buddy2',
      screenName: 'Friend2',
      email: 'friend2@example.com',
      profile: { displayName: 'Friend Two', awayMessage: 'Gone fishing' },
      status: 'away' as UserStatus,
      lastSeen: new Date(),
      createdAt: new Date(),
      relationship: {
        id: 'rel2',
        userId: 'user1',
        buddyId: 'buddy2',
        groupName: 'Friends',
        addedAt: new Date()
      }
    },
    {
      id: 'buddy3',
      screenName: 'Colleague1',
      email: 'colleague1@example.com',
      profile: { displayName: 'Work Buddy', awayMessage: '' },
      status: 'offline' as UserStatus,
      lastSeen: new Date(),
      createdAt: new Date(),
      relationship: {
        id: 'rel3',
        userId: 'user1',
        buddyId: 'buddy3',
        groupName: 'Work',
        addedAt: new Date()
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'aim_token') return 'test-token';
      if (key === 'aim_user') return JSON.stringify(mockUser);
      return null;
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders buddy list window with classic AIM styling', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Buddy List')).toBeInTheDocument();
    });

    // Check for classic AIM window structure
    expect(document.querySelector('.aim-window')).toBeInTheDocument();
    expect(document.querySelector('.aim-window-header')).toBeInTheDocument();
    expect(document.querySelector('.aim-window-controls')).toBeInTheDocument();
    expect(document.querySelector('.buddy-list-icon')).toBeInTheDocument();
  });

  it('displays loading state while fetching buddy list', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    expect(screen.getByText('Loading buddy list...')).toBeInTheDocument();
    expect(document.querySelector('.aim-loading-animation')).toBeInTheDocument();
  });

  it('displays empty state when no buddies exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No buddies yet!')).toBeInTheDocument();
      expect(screen.getByText('Add some friends to get started.')).toBeInTheDocument();
      expect(screen.getByText('Add Buddy')).toBeInTheDocument();
    });
  });

  it('displays error state when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error'
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('displays buddies grouped by their group names', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuddies
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Friends')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Friend1')).toBeInTheDocument();
      expect(screen.getByText('Friend2')).toBeInTheDocument();
      expect(screen.getByText('Colleague1')).toBeInTheDocument();
    });
    
    // Check for group counts
    expect(screen.getByText('(1/2)')).toBeInTheDocument(); // Friends group: 1 online out of 2
    expect(screen.getByText('(0/1)')).toBeInTheDocument(); // Work group: 0 online out of 1
  });

  it('toggles group expansion when clicking on group header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuddies
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Friends')).toBeInTheDocument();
    });
    
    // Initially expanded
    expect(screen.getByText('Friend1')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(screen.getByText('Friends'));
    
    // Should be collapsed now
    expect(screen.queryByText('Friend1')).not.toBeInTheDocument();
    
    // Click to expand again
    fireEvent.click(screen.getByText('Friends'));
    
    // Should be visible again
    expect(screen.getByText('Friend1')).toBeInTheDocument();
  });

  it('sets up WebSocket listeners for real-time updates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(socketService.connect).toHaveBeenCalledWith('test-token');
    });

    // Check that event listeners are set up
    expect(mockSocket.on).toHaveBeenCalledWith('buddy:online', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('buddy:offline', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('buddy:status-change', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('buddy:added', expect.any(Function));
  });
  
  it('shows away message indicator for buddies with away status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuddies
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Friend2')).toBeInTheDocument();
    });
    
    // Friend2 has away status with message
    const awayIndicator = document.querySelector('.buddy-away-indicator');
    expect(awayIndicator).toBeInTheDocument();
    expect(awayIndicator).toHaveAttribute('title', 'Gone fishing');
  });
  
  it('displays toolbar with buddy management buttons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuddies
    });

    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(document.querySelector('.buddy-list-toolbar')).toBeInTheDocument();
    });
    
    const toolButtons = document.querySelectorAll('.buddy-list-tool-button');
    expect(toolButtons.length).toBe(3); // Add Buddy, Create Group, Preferences
    
    expect(toolButtons[0]).toHaveAttribute('title', 'Add Buddy');
    expect(toolButtons[1]).toHaveAttribute('title', 'Create Group');
    expect(toolButtons[2]).toHaveAttribute('title', 'Preferences');
  });
  
  it('calls onBuddyDoubleClick when a buddy is double-clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuddies
    });
    
    const handleDoubleClick = vi.fn();
    
    render(
      <AuthProvider>
        <BuddyList onBuddyDoubleClick={handleDoubleClick} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Friend1')).toBeInTheDocument();
    });
    
    // Double click on a buddy
    fireEvent.doubleClick(screen.getByText('Friend1'));
    
    expect(handleDoubleClick).toHaveBeenCalledTimes(1);
    expect(handleDoubleClick).toHaveBeenCalledWith(expect.objectContaining({
      id: 'buddy1',
      screenName: 'Friend1'
    }));
  });
  
  it('shows context menu on right-click and hides on click elsewhere', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBuddies
    });
    
    render(
      <AuthProvider>
        <BuddyList />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Friend1')).toBeInTheDocument();
    });
    
    // Context menu should not be visible initially
    expect(document.querySelector('.buddy-context-menu')).not.toBeInTheDocument();
    
    // Right click on a buddy
    fireEvent.contextMenu(screen.getByText('Friend1'));
    
    // Context menu should now be visible
    expect(document.querySelector('.buddy-context-menu')).toBeInTheDocument();
    expect(screen.getByText('Send Instant Message')).toBeInTheDocument();
    expect(screen.getByText('Delete Buddy')).toBeInTheDocument();
    
    // Click elsewhere to dismiss
    fireEvent.click(document.body);
    
    // Context menu should be hidden
    expect(document.querySelector('.buddy-context-menu')).not.toBeInTheDocument();
  });
});