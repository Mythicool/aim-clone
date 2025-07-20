/**
 * Utility functions for window notifications like flashing the title
 */

let originalTitle = document.title;
let flashInterval: number | null = null;

/**
 * Starts flashing the window title to notify the user
 * @param message The message to flash in the title
 */
export const startWindowFlashing = (message: string): void => {
  // Save original title if not already saved
  if (!originalTitle) {
    originalTitle = document.title;
  }
  
  // Clear any existing interval
  if (flashInterval) {
    clearInterval(flashInterval);
  }
  
  // Set up flashing interval
  let isOriginal = false;
  flashInterval = window.setInterval(() => {
    document.title = isOriginal ? originalTitle : message;
    isOriginal = !isOriginal;
  }, 1000);
};

/**
 * Stops flashing the window title and restores the original title
 */
export const stopWindowFlashing = (): void => {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
    document.title = originalTitle;
  }
};

/**
 * Checks if the window is currently focused
 * @returns boolean indicating if window is focused
 */
export const isWindowFocused = (): boolean => {
  return document.hasFocus();
};

/**
 * Handles window focus change
 * @param callback Function to call when window focus changes
 */
export const handleWindowFocusChange = (callback: (isFocused: boolean) => void): () => void => {
  const handleFocus = () => callback(true);
  const handleBlur = () => callback(false);
  
  window.addEventListener('focus', handleFocus);
  window.addEventListener('blur', handleBlur);
  
  return () => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('blur', handleBlur);
  };
};