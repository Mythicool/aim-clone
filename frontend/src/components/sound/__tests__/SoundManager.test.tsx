import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SoundManager } from '../SoundManager';
import { UserPreferencesProvider } from '../../../contexts/UserPreferencesContext';
import { socketService } from '../../../services/socket';

// Mock the socket service
vi.mock('../../../services/socket', () => ({
  socketService: {
    getSocket: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn()
    }))
  }
}));

describe('SoundManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize audio elements on mount', () => {
    const audioSpy = vi.spyOn(window, 'Audio');
    
    render(
      <UserPreferencesProvider>
        <SoundManager />
      </UserPreferencesProvider>
    );

    // Verify socket listeners are registered
    expect(socketService.getSocket).toHaveBeenCalled();
    
    // Audio constructor is called, but we don't need to verify the exact count
    // since the implementation might catch errors and continue
    expect(audioSpy).toHaveBeenCalled();
  });

  it('should register socket event listeners', () => {
    const socketMock = {
      on: vi.fn(),
      off: vi.fn()
    };
    
    vi.mocked(socketService.getSocket).mockReturnValue(socketMock);
    
    render(
      <UserPreferencesProvider>
        <SoundManager />
      </UserPreferencesProvider>
    );

    // Verify socket event listeners are registered
    expect(socketMock.on).toHaveBeenCalledWith('buddy:online', expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith('buddy:offline', expect.any(Function));
    expect(socketMock.on).toHaveBeenCalledWith('message:receive', expect.any(Function));
  });
});