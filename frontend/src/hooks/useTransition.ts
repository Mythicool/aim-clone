import { useState, useEffect, useRef, useCallback } from 'react';

export type TransitionState = 'entering' | 'entered' | 'exiting' | 'exited';

interface UseTransitionOptions {
  duration?: number;
  enterDelay?: number;
  exitDelay?: number;
  onEnter?: () => void;
  onEntered?: () => void;
  onExit?: () => void;
  onExited?: () => void;
}

export const useTransition = (
  show: boolean,
  options: UseTransitionOptions = {}
) => {
  const {
    duration = 300,
    enterDelay = 0,
    exitDelay = 0,
    onEnter,
    onEntered,
    onExit,
    onExited
  } = options;

  const [state, setState] = useState<TransitionState>(show ? 'entered' : 'exited');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const clearTimeout = useCallback(() => {
    if (timeoutRef.current) {
      global.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    clearTimeout();

    if (show) {
      if (state === 'exited') {
        setState('entering');
        onEnter?.();
        
        timeoutRef.current = setTimeout(() => {
          setState('entered');
          onEntered?.();
        }, enterDelay + duration);
      }
    } else {
      if (state === 'entered' || state === 'entering') {
        setState('exiting');
        onExit?.();
        
        timeoutRef.current = setTimeout(() => {
          setState('exited');
          onExited?.();
        }, exitDelay + duration);
      }
    }

    return clearTimeout;
  }, [show, state, duration, enterDelay, exitDelay, onEnter, onEntered, onExit, onExited, clearTimeout]);

  const shouldRender = state !== 'exited';
  const isVisible = state === 'entering' || state === 'entered';

  return {
    state,
    shouldRender,
    isVisible,
    style: {
      transition: `all ${duration}ms ease-in-out`,
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'scale(1)' : 'scale(0.95)'
    }
  };
};

interface UseSlideTransitionOptions extends UseTransitionOptions {
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}

export const useSlideTransition = (
  show: boolean,
  options: UseSlideTransitionOptions = {}
) => {
  const {
    direction = 'up',
    distance = 20,
    ...transitionOptions
  } = options;

  const transition = useTransition(show, transitionOptions);

  const getTransform = () => {
    if (transition.isVisible) return 'translate(0, 0)';
    
    switch (direction) {
      case 'up':
        return `translate(0, ${distance}px)`;
      case 'down':
        return `translate(0, -${distance}px)`;
      case 'left':
        return `translate(${distance}px, 0)`;
      case 'right':
        return `translate(-${distance}px, 0)`;
      default:
        return 'translate(0, 0)';
    }
  };

  return {
    ...transition,
    style: {
      ...transition.style,
      transform: getTransform()
    }
  };
};

interface UseFadeTransitionOptions extends UseTransitionOptions {
  startOpacity?: number;
  endOpacity?: number;
}

export const useFadeTransition = (
  show: boolean,
  options: UseFadeTransitionOptions = {}
) => {
  const {
    startOpacity = 0,
    endOpacity = 1,
    ...transitionOptions
  } = options;

  const transition = useTransition(show, transitionOptions);

  return {
    ...transition,
    style: {
      ...transition.style,
      opacity: transition.isVisible ? endOpacity : startOpacity,
      transform: 'none'
    }
  };
};

interface UseScaleTransitionOptions extends UseTransitionOptions {
  startScale?: number;
  endScale?: number;
}

export const useScaleTransition = (
  show: boolean,
  options: UseScaleTransitionOptions = {}
) => {
  const {
    startScale = 0.8,
    endScale = 1,
    ...transitionOptions
  } = options;

  const transition = useTransition(show, transitionOptions);

  return {
    ...transition,
    style: {
      ...transition.style,
      transform: `scale(${transition.isVisible ? endScale : startScale})`,
      transformOrigin: 'center'
    }
  };
};

// Staggered animations for lists
export const useStaggeredTransition = (
  items: any[],
  show: boolean,
  options: UseTransitionOptions & { staggerDelay?: number } = {}
) => {
  const { staggerDelay = 50, ...transitionOptions } = options;
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (show) {
      items.forEach((_, index) => {
        setTimeout(() => {
          setVisibleItems(prev => new Set([...prev, index]));
        }, index * staggerDelay);
      });
    } else {
      setVisibleItems(new Set());
    }
  }, [show, items.length, staggerDelay]);

  return items.map((item, index) => {
    const isVisible = visibleItems.has(index);
    const transition = useTransition(isVisible, transitionOptions);
    
    return {
      item,
      index,
      ...transition
    };
  });
};

// Animation utilities
export const animationClasses = {
  fadeIn: 'fade-in',
  fadeOut: 'fade-out',
  slideInUp: 'slide-in-up',
  slideInDown: 'slide-in-down',
  scaleIn: 'scale-in',
  pulse: 'pulse-loading'
};

export const useAnimationClass = (
  trigger: boolean,
  animationClass: string,
  duration: number = 300
) => {
  const [className, setClassName] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (trigger) {
      setClassName(animationClass);
      timeoutRef.current = setTimeout(() => {
        setClassName('');
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [trigger, animationClass, duration]);

  return className;
};

// Performance-optimized transition for large lists
export const useVirtualTransition = (
  items: any[],
  visibleRange: { start: number; end: number },
  show: boolean,
  options: UseTransitionOptions = {}
) => {
  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  
  return visibleItems.map((item, index) => {
    const actualIndex = visibleRange.start + index;
    const transition = useTransition(show, {
      ...options,
      enterDelay: (options.enterDelay || 0) + (index * 20) // Stagger by 20ms
    });
    
    return {
      item,
      index: actualIndex,
      ...transition
    };
  });
};
