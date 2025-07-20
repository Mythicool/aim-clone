import React from 'react';
import './LoadingStates.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = '#0066cc',
  className = ''
}) => (
  <div className={`loading-spinner ${size} ${className}`}>
    <div 
      className="spinner-circle"
      style={{ borderTopColor: color }}
    />
  </div>
);

interface LoadingDotsProps {
  className?: string;
  color?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  className = '',
  color = '#0066cc'
}) => (
  <div className={`loading-dots ${className}`}>
    <div className="dot" style={{ backgroundColor: color }} />
    <div className="dot" style={{ backgroundColor: color }} />
    <div className="dot" style={{ backgroundColor: color }} />
  </div>
);

interface LoadingBarProps {
  progress?: number; // 0-100
  indeterminate?: boolean;
  className?: string;
  color?: string;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({
  progress = 0,
  indeterminate = false,
  className = '',
  color = '#0066cc'
}) => (
  <div className={`loading-bar ${indeterminate ? 'indeterminate' : ''} ${className}`}>
    <div 
      className="bar-fill"
      style={{
        width: indeterminate ? '100%' : `${Math.min(100, Math.max(0, progress))}%`,
        backgroundColor: color
      }}
    />
  </div>
);

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1em',
  borderRadius = '4px',
  className = '',
  animate = true
}) => (
  <div 
    className={`skeleton ${animate ? 'animate' : ''} ${className}`}
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius
    }}
  />
);

interface MessageSkeletonProps {
  count?: number;
  className?: string;
}

export const MessageSkeleton: React.FC<MessageSkeletonProps> = ({
  count = 3,
  className = ''
}) => (
  <div className={`message-skeleton-container ${className}`}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="message-skeleton">
        <div className="message-header-skeleton">
          <Skeleton width="80px" height="12px" />
          <Skeleton width="60px" height="10px" />
        </div>
        <Skeleton 
          width={`${60 + Math.random() * 40}%`} 
          height="14px" 
          className="message-content-skeleton" 
        />
      </div>
    ))}
  </div>
);

interface BuddyListSkeletonProps {
  count?: number;
  className?: string;
}

export const BuddyListSkeleton: React.FC<BuddyListSkeletonProps> = ({
  count = 5,
  className = ''
}) => (
  <div className={`buddy-list-skeleton ${className}`}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="buddy-skeleton">
        <Skeleton width="16px" height="16px" borderRadius="50%" />
        <div className="buddy-info-skeleton">
          <Skeleton width="80px" height="12px" />
          <Skeleton width="60px" height="10px" />
        </div>
      </div>
    ))}
  </div>
);

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  children?: React.ReactNode;
  className?: string;
  backdrop?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  children,
  className = '',
  backdrop = true
}) => {
  if (!isVisible) return null;

  return (
    <div className={`loading-overlay ${backdrop ? 'with-backdrop' : ''} ${className}`}>
      <div className="loading-content">
        {children || (
          <>
            <LoadingSpinner size="large" />
            <div className="loading-message">{message}</div>
          </>
        )}
      </div>
    </div>
  );
};

interface InlineLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  className?: string;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  isLoading,
  children,
  loadingComponent,
  className = ''
}) => (
  <div className={`inline-loading ${className}`}>
    {isLoading ? (
      loadingComponent || <LoadingSpinner size="small" />
    ) : (
      children
    )}
  </div>
);

interface LazyLoadingProps {
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  className?: string;
  threshold?: number;
}

export const LazyLoading: React.FC<LazyLoadingProps> = ({
  isLoading,
  hasMore,
  onLoadMore,
  children,
  loadingComponent,
  className = '',
  threshold = 100
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasMore || isLoading) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, onLoadMore, threshold]);

  return (
    <div ref={containerRef} className={`lazy-loading ${className}`}>
      {children}
      {isLoading && (
        <div className="lazy-loading-indicator">
          {loadingComponent || <LoadingDots />}
        </div>
      )}
    </div>
  );
};

interface PulseLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PulseLoading: React.FC<PulseLoadingProps> = ({
  isLoading,
  children,
  className = ''
}) => (
  <div className={`pulse-loading ${isLoading ? 'loading' : ''} ${className}`}>
    {children}
  </div>
);
