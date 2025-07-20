import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock for static assets
vi.mock('../assets/sounds/buddy_in.mp3', () => ({ default: 'buddy_in.mp3' }));
vi.mock('../assets/sounds/buddy_out.mp3', () => ({ default: 'buddy_out.mp3' }));
vi.mock('../assets/sounds/message_received.mp3', () => ({ default: 'message_received.mp3' }));
vi.mock('../assets/sounds/message_sent.mp3', () => ({ default: 'message_sent.mp3' }));
vi.mock('../assets/sounds/door_opening.mp3', () => ({ default: 'door_opening.mp3' }));
vi.mock('../assets/sounds/door_closing.mp3', () => ({ default: 'door_closing.mp3' }));

// Mock for localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
    clear: vi.fn(() => null),
  },
  writable: true
});

// Mock for Audio
class AudioMock {
  src: string;
  volume: number;
  play: () => Promise<void>;
  
  constructor(src: string) {
    this.src = src;
    this.volume = 1;
    this.play = vi.fn().mockResolvedValue(undefined);
  }
}

global.Audio = AudioMock as any;

// Mock for document.hasFocus
Object.defineProperty(document, 'hasFocus', {
  value: vi.fn(() => true),
  writable: true
});

// Mock for window.setInterval and window.clearInterval
global.setInterval = vi.fn(() => 1) as any;
global.clearInterval = vi.fn() as any;