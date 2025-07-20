import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { validateScreenName, validatePassword } from '../../utils/validation';
import '../../styles/aim-classic.css';

interface LoginWindowProps {
  onSwitchToRegister: () => void;
}

interface ValidationErrors {
  screenName?: string;
  password?: string;
}

export function LoginWindow({ onSwitchToRegister }: LoginWindowProps) {
  const [screenName, setScreenName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const { login, isLoading, error, clearError } = useAuth();

  // Clear error when component mounts or inputs change
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [screenName, password, clearError]);

  const validateField = (field: 'screenName' | 'password', value: string): string | undefined => {
    if (field === 'screenName') {
      return validateScreenName(value);
    } else if (field === 'password') {
      return validatePassword(value);
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    const screenNameError = validateField('screenName', screenName.trim());
    const passwordError = validateField('password', password);

    if (screenNameError) errors.screenName = screenNameError;
    if (passwordError) errors.password = passwordError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await login(screenName.trim(), password);
  };

  const handleInputChange = (field: 'screenName' | 'password') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;

    if (field === 'screenName') {
      setScreenName(value);
    } else {
      setPassword(value);
    }

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleInputBlur = (field: 'screenName' | 'password') => () => {
    const value = field === 'screenName' ? screenName : password;
    const error = validateField(field, value);

    if (error) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit(e as any);
    }
  };

  return (
    <div className="aim-window login-window">
      <div className="aim-window-header">
        <div className="aim-window-title">
          <span>AOL Instant Messenger</span>
        </div>
        <div className="aim-window-controls">
          <div className="aim-window-control">_</div>
          <div className="aim-window-control">×</div>
        </div>
      </div>
      
      <div className="aim-window-content">
        <div className="login-logo">
          <h1>AIM</h1>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="screenName">
              Screen Name:
            </label>
            <input
              id="screenName"
              type="text"
              className="form-input"
              value={screenName}
              onChange={handleInputChange('screenName')}
              onBlur={handleInputBlur('screenName')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              placeholder="Enter your screen name"
              autoComplete="username"
              maxLength={50}
            />
            {validationErrors.screenName && (
              <div className="error-message" style={{ margin: '2px 0 0 0', padding: '2px 4px' }}>
                {validationErrors.screenName}
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password:
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={handleInputChange('password')}
              onBlur={handleInputBlur('password')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            {validationErrors.password && (
              <div className="error-message" style={{ margin: '2px 0 0 0', padding: '2px 4px' }}>
                {validationErrors.password}
              </div>
            )}
          </div>
          
          <div className="form-checkbox">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="rememberMe">Remember my Screen Name</label>
          </div>
          
          <div className="form-buttons">
            <button
              type="submit"
              className="aim-button aim-button-primary"
              disabled={isLoading || !screenName.trim() || !password.trim() || Object.keys(validationErrors).length > 0}
            >
              {isLoading ? (
                <span className="loading-indicator">
                  Signing In<span className="loading-dots">...</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
            
            <button
              type="button"
              className="aim-button"
              onClick={onSwitchToRegister}
              disabled={isLoading}
            >
              Register
            </button>
          </div>
        </form>
        
        <div className="auth-link" onClick={onSwitchToRegister}>
          Don't have an account? Click here to register
        </div>
      </div>
    </div>
  );
}