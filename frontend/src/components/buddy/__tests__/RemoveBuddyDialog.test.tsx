import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RemoveBuddyDialog } from '../RemoveBuddyDialog';
import { AuthProvider } from '../../../contexts/AuthContext';
import type { Buddy } from '../../../types';

// Mock fetch
global.fetch = vi.fn();

// Mock AuthContext
const mockAuthContext = {
  user: {
    id: '1',
    screenName: 'testuser',
    email: 'test@example.com',
    profile: {},
    status: 'online' as const,
    lastSeen: new Date(),
    createdAt: new Date()
  },
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

describe('RemoveBuddyDialog', () => {
  const mockBuddy: Buddy = {
    id: '2',
    screenName: 'testbuddy',
    profile: {
      displayName: 'Test Buddy',
      location: 'Test City',
      interests: 'Testing',
      awayMessage: ''
    },
    status: 'online',
    lastSeen: new Date(),
    createdAt: new Date()
  };

  const onCloseMock = vi.fn();
  const onBuddyRemovedMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  it('should render the remove buddy dialog', () => {
    render(
      <AuthProvider>
        <RemoveBuddyDialog 
          buddy={mockBuddy} 
          onClose={onCloseMock} 
          onBuddyRemoved={onBuddyRemovedMock} 
        />
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { name: 'Remove Buddy' })).toBeInTheDocument();
    expect(screen.getByText('testbuddy')).toBeInTheDocument();
    expect(screen.getByText('(Test Buddy)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Buddy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should show warning message', () => {
    render(
      <AuthProvider>
        <RemoveBuddyDialog 
          buddy={mockBuddy} 
          onClose={onCloseMock} 
          onBuddyRemoved={onBuddyRemovedMock} 
        />
      </AuthProvider>
    );

    expect(screen.getByText(/Are you sure you want to remove/)).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
  });

  it('should remove buddy when Remove Buddy button is clicked', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    render(
      <AuthProvider>
        <RemoveBuddyDialog 
          buddy={mockBuddy} 
          onClose={onCloseMock} 
          onBuddyRemoved={onBuddyRemovedMock} 
        />
      </AuthProvider>
    );

    const removeButtons = screen.getAllByText('Remove Buddy');
    const removeButton = removeButtons.find(button => button.tagName === 'BUTTON');

    fireEvent.click(removeButton!);

    await waitFor(() => {
      expect(onBuddyRemovedMock).toHaveBeenCalledWith(mockBuddy);
      expect(onCloseMock).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/buddies/remove/testbuddy',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
    );
  });

  it('should handle remove buddy error', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Failed to remove buddy' } })
    });

    render(
      <AuthProvider>
        <RemoveBuddyDialog 
          buddy={mockBuddy} 
          onClose={onCloseMock} 
          onBuddyRemoved={onBuddyRemovedMock} 
        />
      </AuthProvider>
    );

    const removeButtons = screen.getAllByText('Remove Buddy');
    const removeButton = removeButtons.find(button => button.tagName === 'BUTTON');

    fireEvent.click(removeButton!);

    await waitFor(() => {
      expect(screen.getByText('Failed to remove buddy')).toBeInTheDocument();
    });

    expect(onBuddyRemovedMock).not.toHaveBeenCalled();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('should close dialog when close button is clicked', () => {
    render(
      <AuthProvider>
        <RemoveBuddyDialog 
          buddy={mockBuddy} 
          onClose={onCloseMock} 
          onBuddyRemoved={onBuddyRemovedMock} 
        />
      </AuthProvider>
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('should close dialog when cancel button is clicked', () => {
    render(
      <AuthProvider>
        <RemoveBuddyDialog 
          buddy={mockBuddy} 
          onClose={onCloseMock} 
          onBuddyRemoved={onBuddyRemovedMock} 
        />
      </AuthProvider>
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCloseMock).toHaveBeenCalled();
  });
});
