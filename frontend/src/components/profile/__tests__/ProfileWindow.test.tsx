import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProfileWindow } from '../ProfileWindow';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock fetch
global.fetch = vi.fn();

// Mock AuthContext
const mockUser = {
  id: '1',
  screenName: 'testuser',
  email: 'test@example.com',
  profile: {
    displayName: 'Test User',
    location: 'Test City',
    interests: 'Testing',
    awayMessage: 'Away for testing'
  },
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

describe('ProfileWindow', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  it('should render the profile window with user information', async () => {
    // Mock successful profile fetch
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        displayName: 'Test User',
        location: 'Test City',
        interests: 'Testing',
        awayMessage: 'Away for testing'
      })
    });

    render(
      <AuthProvider>
        <ProfileWindow onClose={onCloseMock} />
      </AuthProvider>
    );

    // Check if the window title is rendered
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    
    // Wait for profile data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    // Mock pending fetch
    (fetch as any).mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <ProfileWindow onClose={onCloseMock} />
      </AuthProvider>
    );

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
  });

  it('should handle profile update submission', async () => {
    // Mock successful profile fetch
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        displayName: 'Test User',
        location: 'Test City',
        interests: 'Testing',
        awayMessage: 'Away for testing'
      })
    });

    // Mock successful profile update
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    render(
      <AuthProvider>
        <ProfileWindow onClose={onCloseMock} />
      </AuthProvider>
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    });

    // Update a field
    const displayNameInput = screen.getByDisplayValue('Test User');
    fireEvent.change(displayNameInput, { target: { value: 'Updated User' } });

    // Submit the form
    const saveButton = screen.getByText('Save Profile');
    fireEvent.click(saveButton);

    // Check if success message appears
    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });
  });

  it('should handle profile update error', async () => {
    // Mock successful profile fetch
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        displayName: 'Test User',
        location: 'Test City',
        interests: 'Testing',
        awayMessage: 'Away for testing'
      })
    });

    // Mock failed profile update
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Update failed' } })
    });

    render(
      <AuthProvider>
        <ProfileWindow onClose={onCloseMock} />
      </AuthProvider>
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    });

    // Submit the form
    const saveButton = screen.getByText('Save Profile');
    fireEvent.click(saveButton);

    // Check if error message appears
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('should close the window when close button is clicked', async () => {
    // Mock successful profile fetch
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        displayName: 'Test User',
        location: 'Test City',
        interests: 'Testing',
        awayMessage: 'Away for testing'
      })
    });

    render(
      <AuthProvider>
        <ProfileWindow onClose={onCloseMock} />
      </AuthProvider>
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should close the window when cancel button is clicked', async () => {
    // Mock successful profile fetch
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        displayName: 'Test User',
        location: 'Test City',
        interests: 'Testing',
        awayMessage: 'Away for testing'
      })
    });

    render(
      <AuthProvider>
        <ProfileWindow onClose={onCloseMock} />
      </AuthProvider>
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
