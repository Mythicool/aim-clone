import { useEffect, useRef } from 'react';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { socketService } from '../../services/socket';

// Define sound asset paths
const SOUND_PATHS = {
  buddyIn: '/src/assets/sounds/buddy_in.mp3',
  buddyOut: '/src/assets/sounds/buddy_out.mp3',
  messageReceived: '/src/assets/sounds/message_received.mp3',
  messageSent: '/src/assets/sounds/message_sent.mp3',
  doorOpening: '/src/assets/sounds/door_opening.mp3',
  doorClosing: '/src/assets/sounds/door_closing.mp3'
};

export const SoundManager: React.FC = () => {
  const { preferences } = useUserPreferences();
  
  // Create refs for audio elements
  const buddyInAudio = useRef<HTMLAudioElement | null>(null);
  const buddyOutAudio = useRef<HTMLAudioElement | null>(null);
  const messageReceivedAudio = useRef<HTMLAudioElement | null>(null);
  const messageSentAudio = useRef<HTMLAudioElement | null>(null);
  const doorOpeningAudio = useRef<HTMLAudioElement | null>(null);
  const doorClosingAudio = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    // Create audio elements
    try {
      buddyInAudio.current = new Audio(SOUND_PATHS.buddyIn);
      buddyOutAudio.current = new Audio(SOUND_PATHS.buddyOut);
      messageReceivedAudio.current = new Audio(SOUND_PATHS.messageReceived);
      messageSentAudio.current = new Audio(SOUND_PATHS.messageSent);
      doorOpeningAudio.current = new Audio(SOUND_PATHS.doorOpening);
      doorClosingAudio.current = new Audio(SOUND_PATHS.doorClosing);
    } catch (err) {
      console.error('Error creating audio elements:', err);
    }
    
    // Set volume for all audio elements
    [
      buddyInAudio.current,
      buddyOutAudio.current,
      messageReceivedAudio.current,
      messageSentAudio.current,
      doorOpeningAudio.current,
      doorClosingAudio.current
    ].forEach(audio => {
      if (audio) {
        audio.volume = preferences.sounds.volume;
      }
    });

    // Play door opening sound when component mounts
    if (preferences.sounds.enabled && preferences.sounds.doorOpening && doorOpeningAudio.current) {
      try {
        doorOpeningAudio.current.play().catch(err => console.error('Error playing sound:', err));
      } catch (err) {
        console.error('Error playing door opening sound:', err);
      }
    }

    // Play door closing sound when component unmounts
    return () => {
      if (preferences.sounds.enabled && preferences.sounds.doorClosing && doorClosingAudio.current) {
        try {
          doorClosingAudio.current.play().catch(err => console.error('Error playing sound:', err));
        } catch (err) {
          console.error('Error playing door closing sound:', err);
        }
      }
    };
  }, []);

  // Update volume when preferences change
  useEffect(() => {
    [
      buddyInAudio.current,
      buddyOutAudio.current,
      messageReceivedAudio.current,
      messageSentAudio.current,
      doorOpeningAudio.current,
      doorClosingAudio.current
    ].forEach(audio => {
      if (audio) {
        audio.volume = preferences.sounds.volume;
      }
    });
  }, [preferences.sounds.volume]);

  // Socket event listeners for buddy status changes and messages
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Buddy online event
    const handleBuddyOnline = () => {
      if (preferences.sounds.enabled && preferences.sounds.buddyIn && buddyInAudio.current) {
        try {
          buddyInAudio.current.play().catch(err => console.error('Error playing sound:', err));
        } catch (err) {
          console.error('Error playing buddy in sound:', err);
        }
      }
    };

    // Buddy offline event
    const handleBuddyOffline = () => {
      if (preferences.sounds.enabled && preferences.sounds.buddyOut && buddyOutAudio.current) {
        try {
          buddyOutAudio.current.play().catch(err => console.error('Error playing sound:', err));
        } catch (err) {
          console.error('Error playing buddy out sound:', err);
        }
      }
    };

    // Message received event
    const handleMessageReceive = () => {
      if (preferences.sounds.enabled && preferences.sounds.messageReceived && messageReceivedAudio.current) {
        try {
          messageReceivedAudio.current.play().catch(err => console.error('Error playing sound:', err));
        } catch (err) {
          console.error('Error playing message received sound:', err);
        }
      }
    };

    // Register socket event listeners
    socket.on('buddy:online', handleBuddyOnline);
    socket.on('buddy:offline', handleBuddyOffline);
    socket.on('message:receive', handleMessageReceive);

    // Custom event for message sent
    const handleMessageSent = () => {
      if (preferences.sounds.enabled && preferences.sounds.messageSent && messageSentAudio.current) {
        try {
          messageSentAudio.current.play().catch(err => console.error('Error playing sound:', err));
        } catch (err) {
          console.error('Error playing message sent sound:', err);
        }
      }
    };

    // Register custom event listener
    window.addEventListener('messageSent', handleMessageSent);

    // Cleanup event listeners
    return () => {
      socket.off('buddy:online', handleBuddyOnline);
      socket.off('buddy:offline', handleBuddyOffline);
      socket.off('message:receive', handleMessageReceive);
      window.removeEventListener('messageSent', handleMessageSent);
    };
  }, [preferences.sounds]);

  // This component doesn't render anything
  return null;
};

export default SoundManager;