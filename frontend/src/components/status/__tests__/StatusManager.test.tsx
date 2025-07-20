import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatusManager } from '../StatusManager';
import { useAuth } from '../../../contexts/AuthContext';
import { socketService } from '../../../services/socket';
import { UserStatus } from '../../../types';

// Mock dependencies
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../services/socket');

describe('StatusManager Component', () => {
  const mockUser = {
    id: 'user123',
    screenName: 'testuser',
    status: UserStatus.ONLINE,
    awayMessage: null
  };
  
  const mockToken = 'mock-token';
  const mockUpdateUser = jest.fn();
  
  const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth context
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      token: mockToken,
      updateUser: mockUpdateUser
    });
    
    // Mock socket service
    (socketService.getSocket as jest.Mock).mockReturnValue(mockSocket);
    
    // Mock fetch
    global.fetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: mockUser })
      })
    );
  });
  
  it('renders status dropdown with current user status', () => {
    render(<StatusManager />);
    
    const statusButton = screen.getByText(mockUser.status);
    expect(statusButton).toBeInTheDocument();
  });
  
  it('shows away message dialog when selecting Away status', async () => {
    render(<StatusManager />);
    
    // Open dropdown and click Away option
    const statusButton = screen.getByText(mockUser.status);
    fireEvent.click(statusButton);
    
    const awayOption = screen.getByText('Away');
    fireEvent.click(awayOption);
    
    // Check if away message dialog appears
    await waitFor(() => {
      expect(screen.getByText('Set Away Message')).toBeInTheDocument();
    });
  });
  
  it('updates status directly when selecting Online status', async () => {
    // Mock user as away first
    (useAuth as jest.Mock).mockReturnValue({
      user: { ...mockUser, status: UserStatus.AWAY },
      token: mockToken,
      updateUser: mockUpdateUser
    });
    
    render(<StatusManager />);
    
    // Open dropdown and click Online option
    const statusButton = screen.getByText(UserStatus.AWAY);
    fireEvent.click(statusButton);
    
    const onlineOption = screen.getByText('Online');
    fireEvent.click(onlineOption);
    
    // Check if socket emit was called with correct status
    expect(mockSocket.emit).toHaveBeenCalledWith('user:status-change', { 
      status: UserStatus.ONLINE 
    });
    
    // Check if API was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/users/status',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ status: UserStatus.ONLINE })
      })
    );
  });
  
  it('sets away message and status when submitting away message dialog', async () => {
    render(<StatusManager />);
    
    // Open dropdown and click Away option
    const statusButton = screen.getByText(mockUser.status);
    fireEvent.click(statusButton);
    
    const awayOption = screen.getByText('Away');
    fireEvent.click(awayOption);
    
    // Enter away message and submit
    const awayMessageInput = await screen.findByPlaceholderText("I'm away from my computer right now...");
    fireEvent.change(awayMessageInput, { target: { value: 'Gone for lunch' } });
    
    const setButton = screen.getByText('Set Away Message');
    fireEvent.click(setButton);
    
    // Check if socket emit was called with correct status and message
    expect(mockSocket.emit).toHaveBeenCalledWith('user:status-change', { 
      status: UserStatus.AWAY,
      awayMessage: 'Gone for lunch'
    });
  });
});