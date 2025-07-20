import React, { useEffect, useState, useRef } from 'react';
import './WindowTransition.css';

interface WindowTransitionProps {
  children: React.ReactNode;
  isVisible: boolean;
  onEnter?: () => void;
  onExit?: () => void;
  onExited?: () => void;
  duration?: number;
  type?: 'fade' | 'scale' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight';
  className?: string;
  style?: React.CSSProperties;
}

export const WindowTransition: React.FC<WindowTransitionProps> = ({
  children,
  isVisible,
  onEnter,
  onExit,
  onExited,
  duration = 200,
  type = 'scale',
  className = '',
  style = {}
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>('exited');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setAnimationState('entering');
      
      // Trigger enter animation
      const enterTimeout = setTimeout(() => {
        setAnimationState('entered');
        onEnter?.();
      }, 10); // Small delay to ensure DOM is ready

      return () => clearTimeout(enterTimeout);
    } else {
      setAnimationState('exiting');
      onExit?.();
      
      // Wait for exit animation to complete
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
        setAnimationState('exited');
        onExited?.();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, duration, onEnter, onExit, onExited]);

  if (!shouldRender) return null;

  const getTransitionClass = () => {
    const baseClass = 'window-transition';
    const typeClass = `${baseClass}--${type}`;
    const stateClass = `${baseClass}--${animationState}`;
    
    return `${baseClass} ${typeClass} ${stateClass} ${className}`;
  };

  const transitionStyle: React.CSSProperties & { [key: string]: any } = {
    ...style,
    '--transition-duration': `${duration}ms`,
  };

  return (
    <div 
      className={getTransitionClass()}
      style={transitionStyle}
    >
      {children}
    </div>
  );
};

// Specialized window transition for AIM windows
interface AIMWindowTransitionProps extends Omit<WindowTransitionProps, 'type'> {
  windowType?: 'chat' | 'buddy' | 'profile' | 'preferences' | 'dialog';
}

export const AIMWindowTransition: React.FC<AIMWindowTransitionProps> = ({
  windowType = 'chat',
  duration = 200,
  ...props
}) => {
  const getTransitionType = () => {
    switch (windowType) {
      case 'chat':
        return 'scale';
      case 'buddy':
        return 'slideUp';
      case 'profile':
      case 'preferences':
        return 'fade';
      case 'dialog':
        return 'scale';
      default:
        return 'scale';
    }
  };

  return (
    <WindowTransition
      {...props}
      type={getTransitionType()}
      duration={duration}
      className={`aim-window-transition aim-window-transition--${windowType} ${props.className || ''}`}
    />
  );
};

// Hook for managing window transitions
export const useWindowTransition = (initialVisible = false) => {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  const show = () => {
    setIsVisible(true);
    setIsAnimating(true);
  };

  const hide = () => {
    setIsVisible(false);
    setIsAnimating(true);
  };

  const toggle = () => {
    if (isVisible) {
      hide();
    } else {
      show();
    }
  };

  const handleEnter = () => {
    setIsAnimating(false);
  };

  const handleExited = () => {
    setIsAnimating(false);
  };

  return {
    isVisible,
    isAnimating,
    show,
    hide,
    toggle,
    handleEnter,
    handleExited,
  };
};

// Staggered animation for multiple windows
interface StaggeredWindowTransitionProps {
  children: React.ReactNode[];
  isVisible: boolean;
  staggerDelay?: number;
  duration?: number;
  type?: WindowTransitionProps['type'];
  className?: string;
}

export const StaggeredWindowTransition: React.FC<StaggeredWindowTransitionProps> = ({
  children,
  isVisible,
  staggerDelay = 50,
  duration = 200,
  type = 'scale',
  className = ''
}) => {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(new Array(children.length).fill(false));

  useEffect(() => {
    if (isVisible) {
      // Stagger the appearance of items
      children.forEach((_, index) => {
        setTimeout(() => {
          setVisibleItems(prev => {
            const newState = [...prev];
            newState[index] = true;
            return newState;
          });
        }, index * staggerDelay);
      });
    } else {
      // Hide all items immediately or with reverse stagger
      setVisibleItems(new Array(children.length).fill(false));
    }
  }, [isVisible, children.length, staggerDelay]);

  return (
    <div className={`staggered-window-transition ${className}`}>
      {children.map((child, index) => (
        <WindowTransition
          key={index}
          isVisible={visibleItems[index]}
          duration={duration}
          type={type}
        >
          {child}
        </WindowTransition>
      ))}
    </div>
  );
};

export default WindowTransition;
