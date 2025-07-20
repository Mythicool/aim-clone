import React from 'react';
import './ErrorDisplay.css';

export interface ErrorDisplayProps {
  error?: string | Error | null;
  errors?: { [field: string]: string };
  type?: 'error' | 'warning' | 'info';
  title?: string;
  showIcon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorDisplay({
  error,
  errors,
  type = 'error',
  title,
  showIcon = true,
  dismissible = false,
  onDismiss,
  className = ''
}: ErrorDisplayProps) {
  // Don't render if no errors
  if (!error && (!errors || Object.keys(errors).length === 0)) {
    return null;
  }

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '✗';
    }
  };

  const getErrorMessage = () => {
    if (error) {
      if (error instanceof Error) {
        return error.message;
      }
      return String(error);
    }
    return null;
  };

  const singleError = getErrorMessage();
  const multipleErrors = errors && Object.keys(errors).length > 0;

  return (
    <div className={`error-display error-display-${type} ${className}`}>
      {title && (
        <div className="error-display-header">
          {showIcon && <span className="error-display-icon">{getIcon()}</span>}
          <span className="error-display-title">{title}</span>
          {dismissible && (
            <button 
              className="error-display-dismiss"
              onClick={onDismiss}
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
      )}
      
      <div className="error-display-content">
        {!title && showIcon && (
          <span className="error-display-icon">{getIcon()}</span>
        )}
        
        {singleError && (
          <div className="error-display-message">
            {singleError}
          </div>
        )}
        
        {multipleErrors && (
          <div className="error-display-list">
            {Object.entries(errors!).map(([field, message]) => (
              <div key={field} className="error-display-item">
                <span className="error-display-field">{field}:</span>
                <span className="error-display-message">{message}</span>
              </div>
            ))}
          </div>
        )}
        
        {!title && dismissible && (
          <button 
            className="error-display-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// Inline error component for form fields
export interface InlineErrorProps {
  error?: string;
  className?: string;
}

export function InlineError({ error, className = '' }: InlineErrorProps) {
  if (!error) return null;
  
  return (
    <div className={`inline-error ${className}`}>
      <span className="inline-error-icon">✗</span>
      <span className="inline-error-message">{error}</span>
    </div>
  );
}

// Toast notification component for temporary errors
export interface ErrorToastProps {
  error: string;
  duration?: number;
  onDismiss: () => void;
  type?: 'error' | 'warning' | 'info' | 'success';
}

export function ErrorToast({ 
  error, 
  duration = 5000, 
  onDismiss, 
  type = 'error' 
}: ErrorToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      case 'success':
        return '✓';
      default:
        return '✗';
    }
  };

  return (
    <div className={`error-toast error-toast-${type}`}>
      <span className="error-toast-icon">{getIcon()}</span>
      <span className="error-toast-message">{error}</span>
      <button 
        className="error-toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

// Network error component with retry option
export interface NetworkErrorProps {
  error: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function NetworkError({ 
  error, 
  onRetry, 
  retrying = false, 
  className = '' 
}: NetworkErrorProps) {
  return (
    <div className={`network-error ${className}`}>
      <div className="network-error-content">
        <span className="network-error-icon">⚠</span>
        <div className="network-error-text">
          <div className="network-error-title">Connection Problem</div>
          <div className="network-error-message">{error}</div>
        </div>
      </div>
      
      {onRetry && (
        <div className="network-error-actions">
          <button 
            className="aim-button network-error-retry"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? (
              <span className="loading-indicator">
                Retrying<span className="loading-dots">...</span>
              </span>
            ) : (
              'Retry'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Validation summary component
export interface ValidationSummaryProps {
  errors: { [field: string]: string };
  title?: string;
  className?: string;
}

export function ValidationSummary({ 
  errors, 
  title = 'Please correct the following errors:', 
  className = '' 
}: ValidationSummaryProps) {
  const errorCount = Object.keys(errors).length;
  
  if (errorCount === 0) return null;
  
  return (
    <div className={`validation-summary ${className}`}>
      <div className="validation-summary-header">
        <span className="validation-summary-icon">✗</span>
        <span className="validation-summary-title">{title}</span>
        <span className="validation-summary-count">({errorCount})</span>
      </div>
      
      <ul className="validation-summary-list">
        {Object.entries(errors).map(([field, message]) => (
          <li key={field} className="validation-summary-item">
            <strong>{field}:</strong> {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
