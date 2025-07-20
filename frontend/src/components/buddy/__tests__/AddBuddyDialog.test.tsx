import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AddBuddyDialog } from '../AddBuddyDialog';
import { AuthProvider } from '../../../contexts/AuthContext';

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

describe('AddBuddyDialog', () => {
  const onCloseMock = vi.fn();
  const onBuddyAddedMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  it('should render the add buddy dialog', () => {
    render(
      <AuthProvider>
        <AddBuddyDialog onClose={onCloseMock} onBuddyAdded={onBuddyAddedMock} />
      </AuthProvider>
    );

    // Check for dialog elements
    expect(screen.getByPlaceholderText('Enter screen name')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('×')).toBeInTheDocument();
  });

  it('should enable search button when screen name is entered', () => {
    render(
      <AuthProvider>
        <AddBuddyDialog onClose={onCloseMock} onBuddyAdded={onBuddyAddedMock} />
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText('Enter screen name');
    const searchButton = screen.getByText('Search');

    expect(searchButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'testbuddy' } });
    expect(searchButton).not.toBeDisabled();
  });

  it('should search for users when search button is clicked', async () => {
    const mockSearchResults = [
      {
        id: '2',
        screenName: 'testbuddy',
        profile: { displayName: 'Test Buddy' }
      }
    ];

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResults
    });

    render(
      <AuthProvider>
        <AddBuddyDialog onClose={onCloseMock} onBuddyAdded={onBuddyAddedMock} />
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText('Enter screen name');
    const searchButton = screen.getByText('Search');

    fireEvent.change(input, { target: { value: 'testbuddy' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Search Results:')).toBeInTheDocument();
      expect(screen.getByText('testbuddy')).toBeInTheDocument();
      expect(screen.getByText('Test Buddy')).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/users/search?screenName=testbuddy',
      expect.objectContaining({
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
    );
  });

  it('should add buddy when Add Buddy button is clicked', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    render(
      <AuthProvider>
        <AddBuddyDialog onClose={onCloseMock} onBuddyAdded={onBuddyAddedMock} />
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText('Enter screen name');
    const addButtons = screen.getAllByText('Add Buddy');
    const addButton = addButtons.find(button => button.tagName === 'BUTTON');

    fireEvent.change(input, { target: { value: 'testbuddy' } });
    fireEvent.click(addButton!);

    await waitFor(() => {
      expect(onBuddyAddedMock).toHaveBeenCalledWith('testbuddy');
      expect(onCloseMock).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/buddies/add',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          screenName: 'testbuddy'
        })
      })
    );
  });

  it('should handle add buddy error', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'User not found' } })
    });

    render(
      <AuthProvider>
        <AddBuddyDialog onClose={onCloseMock} onBuddyAdded={onBuddyAddedMock} />
      </AuthProvider>
    );

    const input = screen.getByPlaceholderText('Enter screen name');
    const addButtons = screen.getAllByText('Add Buddy');
    const addButton = addButtons.find(button => button.tagName === 'BUTTON');

    fireEvent.change(input, { target: { value: 'nonexistent' } });
    fireEvent.click(addButton!);

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });

    expect(onBuddyAddedMock).not.toHaveBeenCalled();
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('should close dialog when close button is clicked', () => {
    render(
      <AuthProvider>
        <AddBuddyDialog onClose={onCloseMock} onBuddyAdded={onBuddyAddedMock} />
      </AuthProvider>
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('should close dialog when cancel button is clicked', () => {
    render(
      <AuthProvider>
        <AddBuddyDialog onClose={onCloseMock} onBuddyAdded={onBuddyAddedMock} />
      </AuthProvider>
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCloseMock).toHaveBeenCalled();
  });
});
