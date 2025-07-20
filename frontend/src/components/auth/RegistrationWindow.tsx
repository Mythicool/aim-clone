import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { validateScreenName, validateEmail, validatePassword, validatePasswordConfirmation } from '../../utils/validation';
import '../../styles/aim-classic.css';

interface RegistrationWindowProps {
  onSwitchToLogin: () => void;
}

interface ValidationErrors {
  screenName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegistrationWindow({ onSwitchToLogin }: RegistrationWindowProps) {
  const [formData, setFormData] = useState({
    screenName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const { register, isLoading, error, clearError } = useAuth();

  // Clear error when component mounts or inputs change
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [formData, clearError]);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    // Screen name validation
    if (!formData.screenName.trim()) {
      errors.screenName = 'Screen name is required';
    } else if (formData.screenName.length < 3) {
      errors.screenName = 'Screen name must be at least 3 characters';
    } else if (formData.screenName.length > 50) {
      errors.screenName = 'Screen name must be less than 50 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.screenName)) {
      errors.screenName = 'Screen name can only contain letters, numbers, underscores, and hyphens';
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleInputBlur = (field: keyof typeof formData) => () => {
    // Validate individual field on blur
    const errors: ValidationErrors = {};
    const currentValue = formData[field];

    if (field === 'screenName') {
      if (!currentValue.trim()) {
        errors.screenName = 'Screen name is required';
      } else if (currentValue.length < 3) {
        errors.screenName = 'Screen name must be at least 3 characters';
      } else if (currentValue.length > 50) {
        errors.screenName = 'Screen name must be less than 50 characters';
      } else if (!/^[a-zA-Z0-9_-]+$/.test(currentValue)) {
        errors.screenName = 'Screen name can only contain letters, numbers, underscores, and hyphens';
      }
    } else if (field === 'email') {
      if (!currentValue.trim()) {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentValue)) {
        errors.email = 'Please enter a valid email address';
      }
    } else if (field === 'password') {
      if (!currentValue) {
        errors.password = 'Password is required';
      } else if (currentValue.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    } else if (field === 'confirmPassword') {
      if (!currentValue) {
        errors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== currentValue) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(prev => ({
        ...prev,
        ...errors
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !agreedToTerms) {
      return;
    }

    await register(
      formData.screenName.trim(),
      formData.password,
      formData.email.trim()
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit(e as any);
    }
  };

  const isFormValid = () => {
    return formData.screenName.trim() &&
           formData.email.trim() &&
           formData.password &&
           formData.confirmPassword &&
           agreedToTerms &&
           Object.keys(validationErrors).length === 0;
  };

  return (
    <div className="aim-window registration-window">
      <div className="aim-window-header">
        <div className="aim-window-title">
          <span>Register New Account</span>
        </div>
        <div className="aim-window-controls">
          <div className="aim-window-control">_</div>
          <div className="aim-window-control" onClick={onSwitchToLogin}>×</div>
        </div>
      </div>
      
      <div className="aim-window-content">
        <div className="login-logo">
          <h1>Create AIM Account</h1>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-screenName">
              Screen Name:
            </label>
            <input
              id="reg-screenName"
              type="text"
              className="form-input"
              value={formData.screenName}
              onChange={handleInputChange('screenName')}
              onBlur={handleInputBlur('screenName')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              placeholder="Choose a unique screen name"
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
            <label className="form-label" htmlFor="reg-email">
              Email Address:
            </label>
            <input
              id="reg-email"
              type="email"
              className="form-input"
              value={formData.email}
              onChange={handleInputChange('email')}
              onBlur={handleInputBlur('email')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              placeholder="Enter your email address"
              autoComplete="email"
            />
            {validationErrors.email && (
              <div className="error-message" style={{ margin: '2px 0 0 0', padding: '2px 4px' }}>
                {validationErrors.email}
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">
              Password:
            </label>
            <input
              id="reg-password"
              type="password"
              className="form-input"
              value={formData.password}
              onChange={handleInputChange('password')}
              onBlur={handleInputBlur('password')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              placeholder="Enter a secure password"
              autoComplete="new-password"
            />
            {validationErrors.password && (
              <div className="error-message" style={{ margin: '2px 0 0 0', padding: '2px 4px' }}>
                {validationErrors.password}
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirmPassword">
              Confirm Password:
            </label>
            <input
              id="reg-confirmPassword"
              type="password"
              className="form-input"
              value={formData.confirmPassword}
              onChange={handleInputChange('confirmPassword')}
              onBlur={handleInputBlur('confirmPassword')}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
            {validationErrors.confirmPassword && (
              <div className="error-message" style={{ margin: '2px 0 0 0', padding: '2px 4px' }}>
                {validationErrors.confirmPassword}
              </div>
            )}
          </div>
          
          <div className="form-checkbox">
            <input
              id="agreedToTerms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="agreedToTerms">I agree to the Terms of Service</label>
          </div>
          
          <div className="form-buttons">
            <button
              type="submit"
              className="aim-button aim-button-primary"
              disabled={isLoading || !isFormValid()}
            >
              {isLoading ? (
                <span className="loading-indicator">
                  Creating Account<span className="loading-dots">...</span>
                </span>
              ) : (
                'Create Account'
              )}
            </button>
            
            <button
              type="button"
              className="aim-button"
              onClick={onSwitchToLogin}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
        
        <div className="auth-link" onClick={onSwitchToLogin}>
          Already have an account? Click here to sign in
        </div>
      </div>
    </div>
  );
}