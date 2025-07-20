import React from 'react';
import './SkeletonLoader.css';

interface SkeletonLoaderProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'message' | 'buddy' | 'profile';
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
  animate?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  width,
  height,
  lines = 1,
  className = '',
  animate = true
}) => {
  const getSkeletonStyle = () => {
    const style: React.CSSProperties = {};
    
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;
    
    return style;
  };

  const renderTextSkeleton = () => {
    return Array.from({ length: lines }, (_, index) => (
      <div
        key={index}
        className={`skeleton skeleton--text ${animate ? 'skeleton--animate' : ''} ${className}`}
        style={{
          ...getSkeletonStyle(),
          width: index === lines - 1 && lines > 1 ? '60%' : width || '100%'
        }}
      />
    ));
  };

  const renderMessageSkeleton = () => (
    <div className={`skeleton-message ${className}`}>
      <div className="skeleton-message__header">
        <div className="skeleton skeleton--text skeleton--animate" style={{ width: '80px', height: '12px' }} />
        <div className="skeleton skeleton--text skeleton--animate" style={{ width: '60px', height: '10px' }} />
      </div>
      <div className="skeleton-message__content">
        <div className="skeleton skeleton--text skeleton--animate" style={{ width: '100%', height: '14px' }} />
        <div className="skeleton skeleton--text skeleton--animate" style={{ width: '75%', height: '14px' }} />
      </div>
    </div>
  );

  const renderBuddySkeleton = () => (
    <div className={`skeleton-buddy ${className}`}>
      <div className="skeleton skeleton--circular skeleton--animate" style={{ width: '12px', height: '12px' }} />
      <div className="skeleton skeleton--text skeleton--animate" style={{ width: '120px', height: '14px' }} />
    </div>
  );

  const renderProfileSkeleton = () => (
    <div className={`skeleton-profile ${className}`}>
      <div className="skeleton-profile__avatar">
        <div className="skeleton skeleton--circular skeleton--animate" style={{ width: '60px', height: '60px' }} />
      </div>
      <div className="skeleton-profile__info">
        <div className="skeleton skeleton--text skeleton--animate" style={{ width: '150px', height: '16px' }} />
        <div className="skeleton skeleton--text skeleton--animate" style={{ width: '100px', height: '12px' }} />
        <div className="skeleton skeleton--text skeleton--animate" style={{ width: '200px', height: '12px' }} />
      </div>
    </div>
  );

  switch (variant) {
    case 'circular':
      return (
        <div
          className={`skeleton skeleton--circular ${animate ? 'skeleton--animate' : ''} ${className}`}
          style={getSkeletonStyle()}
        />
      );
    
    case 'rectangular':
      return (
        <div
          className={`skeleton skeleton--rectangular ${animate ? 'skeleton--animate' : ''} ${className}`}
          style={getSkeletonStyle()}
        />
      );
    
    case 'message':
      return renderMessageSkeleton();
    
    case 'buddy':
      return renderBuddySkeleton();
    
    case 'profile':
      return renderProfileSkeleton();
    
    case 'text':
    default:
      return <>{renderTextSkeleton()}</>;
  }
};

// Specialized skeleton components for common use cases
export const MessageSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="skeleton-message-list">
    {Array.from({ length: count }, (_, index) => (
      <SkeletonLoader key={index} variant="message" />
    ))}
  </div>
);

export const BuddyListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="skeleton-buddy-list">
    {Array.from({ length: count }, (_, index) => (
      <SkeletonLoader key={index} variant="buddy" />
    ))}
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <SkeletonLoader variant="profile" />
);

// Loading overlay component
interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  variant?: 'spinner' | 'dots' | 'pulse';
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  variant = 'dots',
  className = ''
}) => {
  if (!isVisible) return null;

  const renderSpinner = () => (
    <div className="loading-spinner">
      <div className="loading-spinner__circle"></div>
    </div>
  );

  const renderDots = () => (
    <div className="loading-dots">
      <div className="loading-dot"></div>
      <div className="loading-dot"></div>
      <div className="loading-dot"></div>
    </div>
  );

  const renderPulse = () => (
    <div className="loading-pulse">
      <div className="loading-pulse__circle"></div>
    </div>
  );

  return (
    <div className={`loading-overlay ${className}`}>
      <div className="loading-overlay__content">
        {variant === 'spinner' && renderSpinner()}
        {variant === 'dots' && renderDots()}
        {variant === 'pulse' && renderPulse()}
        {message && <div className="loading-overlay__message">{message}</div>}
      </div>
    </div>
  );
};

// Transition wrapper for smooth animations
interface TransitionWrapperProps {
  children: React.ReactNode;
  isVisible: boolean;
  duration?: number;
  type?: 'fade' | 'slide' | 'scale' | 'slideUp' | 'slideDown';
  className?: string;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  children,
  isVisible,
  duration = 300,
  type = 'fade',
  className = ''
}) => {
  const [shouldRender, setShouldRender] = React.useState(isVisible);

  React.useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  if (!shouldRender) return null;

  return (
    <div
      className={`transition-wrapper transition-wrapper--${type} ${
        isVisible ? 'transition-wrapper--visible' : 'transition-wrapper--hidden'
      } ${className}`}
      style={{ '--transition-duration': `${duration}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export default SkeletonLoader;
