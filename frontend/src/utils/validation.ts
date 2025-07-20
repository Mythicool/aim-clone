export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | undefined;
  message?: string;
}

export interface ValidationRules {
  [field: string]: ValidationRule[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: { [field: string]: string };
}

/**
 * Validates a single field against a set of rules
 */
export function validateField(value: string, rules: ValidationRule[]): string | undefined {
  for (const rule of rules) {
    // Required validation
    if (rule.required && (!value || value.trim().length === 0)) {
      return rule.message || 'This field is required';
    }

    // Skip other validations if field is empty and not required
    if (!value || value.trim().length === 0) {
      continue;
    }

    // Min length validation
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return rule.message || `Must be at least ${rule.minLength} characters`;
    }

    // Max length validation
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return rule.message || `Must be less than ${rule.maxLength} characters`;
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
      return rule.message || 'Invalid format';
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) {
        return customError;
      }
    }
  }

  return undefined;
}

/**
 * Validates multiple fields against their respective rules
 */
export function validateForm(data: { [field: string]: string }, rules: ValidationRules): ValidationResult {
  const errors: { [field: string]: string } = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field] || '';
    const error = validateField(value, fieldRules);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Common validation rules for AIM application
 */
export const ValidationRules = {
  screenName: [
    { required: true, message: 'Screen name is required' },
    { minLength: 3, message: 'Screen name must be at least 3 characters' },
    { maxLength: 50, message: 'Screen name must be less than 50 characters' },
    { 
      pattern: /^[a-zA-Z0-9_-]+$/, 
      message: 'Screen name can only contain letters, numbers, underscores, and hyphens' 
    }
  ],
  
  email: [
    { required: true, message: 'Email is required' },
    { 
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
      message: 'Please enter a valid email address' 
    }
  ],
  
  password: [
    { required: true, message: 'Password is required' },
    { minLength: 6, message: 'Password must be at least 6 characters' }
  ],
  
  displayName: [
    { maxLength: 50, message: 'Display name cannot exceed 50 characters' }
  ],
  
  location: [
    { maxLength: 100, message: 'Location cannot exceed 100 characters' }
  ],
  
  interests: [
    { maxLength: 500, message: 'Interests cannot exceed 500 characters' }
  ],
  
  awayMessage: [
    { maxLength: 200, message: 'Away message cannot exceed 200 characters' }
  ],
  
  messageContent: [
    { required: true, message: 'Message cannot be empty' },
    { maxLength: 2000, message: 'Message cannot exceed 2000 characters' }
  ]
};

/**
 * Validates screen name with specific AIM requirements
 */
export function validateScreenName(screenName: string): string | undefined {
  return validateField(screenName, ValidationRules.screenName);
}

/**
 * Validates email address
 */
export function validateEmail(email: string): string | undefined {
  return validateField(email, ValidationRules.email);
}

/**
 * Validates password
 */
export function validatePassword(password: string): string | undefined {
  return validateField(password, ValidationRules.password);
}

/**
 * Validates password confirmation
 */
export function validatePasswordConfirmation(password: string, confirmPassword: string): string | undefined {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return undefined;
}

/**
 * Validates message content
 */
export function validateMessage(content: string): string | undefined {
  return validateField(content, ValidationRules.messageContent);
}

/**
 * Real-time validation hook for forms
 */
export function createFormValidator(rules: ValidationRules) {
  return {
    validateField: (field: string, value: string) => {
      const fieldRules = rules[field];
      if (!fieldRules) return undefined;
      return validateField(value, fieldRules);
    },
    
    validateForm: (data: { [field: string]: string }) => {
      return validateForm(data, rules);
    }
  };
}

/**
 * Sanitizes user input to prevent XSS and other attacks
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags completely
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=\s*[^>\s]*/gi, ''); // Remove event handlers
}

/**
 * Validates and sanitizes user input
 */
export function validateAndSanitize(input: string, rules: ValidationRule[]): { 
  isValid: boolean; 
  value: string; 
  error?: string 
} {
  const sanitized = sanitizeInput(input);
  const error = validateField(sanitized, rules);
  
  return {
    isValid: !error,
    value: sanitized,
    error
  };
}
