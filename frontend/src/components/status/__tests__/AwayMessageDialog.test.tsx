import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AwayMessageDialog } from '../AwayMessageDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { socketService } from '../../../services/socket';
import { UserStatus } from '../../../types';

// Mock dependencies
vi.mock('../../../contexts/AuthContext');
vi.mock('../../../services/socket');

describe('AwayMessageDialog Component', () => {
  const mockUser = {
    id: 'user123',
    screenName: 'testuser',
    status: UserStatus.ONLINE
  };
  
  const mockToken = 'mock-token';
  const mockOnClose = jest.fn();
  
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
      token: mockToken
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
  
  it('renders away message dialog with empty input', () => {
    render(<AwayMessageDialog onClose={mockOnClose} />);
    
    expect(screen.getByText('Set Away Message')).toBeInTheDocument();
    expect(screen.getByPlaceholderText("I'm away from my computer right now...")).toBeInTheDocument();
    expect(screen.getByText('0/200 characters')).toBeInTheDocument();
  });
  
  it('renders with initial message if provided', () => {
    const initialMessage = 'Gone for lunch';
    render(<AwayMessageDialog onClose={mockOnClose} initialMessage={initialMessage} />);
    
    const input = screen.getByPlaceholderText("I'm away from my computer right now...");
    expect(input).toHaveValue(initialMessage);
    expect(screen.getByText(`${initialMessage.length}/200 characters`)).toBeInTheDocument();
  });
  
  it('updates character count when typing', () => {
    render(<AwayMessageDialog onClose={mockOnClose} />);
    
    const input = screen.getByPlaceholderText("I'm away from my computer right now...");
    fireEvent.change(input, { target: { value: 'Be back soon' } });
    
    expect(screen.getByText('12/200 characters')).toBeInTheDocument();
  });
  
  it('calls onClose when cancel button is clicked', () => {
    render(<AwayMessageDialog onClose={mockOnClose} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
  
  it('sets away message and status when save button is clicked', async () => {
    render(<AwayMessageDialog onClose={mockOnClose} />);
    
    const input = screen.getByPlaceholderText("I'm away from my computer right now...");
    fireEvent.change(input, { target: { value: 'Be back soon' } });
    
    const saveButton = screen.getByText('Set Away Message');
    fireEvent.click(saveButton);
    
    // Check if socket emit was called with correct status and message
    expect(mockSocket.emit).toHaveBeenCalledWith('user:status-change', { 
      status: UserStatus.AWAY,
      awayMessage: 'Be back soon'
    });
    
    // Check if API was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/users/status',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ 
          status: UserStatus.AWAY,
          awayMessage: 'Be back soon'
        })
      })
    );
    
    // Check if onClose was called after successful save
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
  
  it('shows error message when API call fails', async () => {
    // Mock fetch to return error
    global.fetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ 
          error: { message: 'Away message cannot exceed 200 characters' } 
        })
      })
    );
    
    render(<AwayMessageDialog onClose={mockOnClose} />);
    
    const input = screen.getByPlaceholderText("I'm away from my computer right now...");
    fireEvent.change(input, { target: { value: 'Be back soon' } });
    
    const saveButton = screen.getByText('Set Away Message');
    fireEvent.click(saveButton);
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Away message cannot exceed 200 characters')).toBeInTheDocument();
    });
    
    // Check that onClose was not called
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});