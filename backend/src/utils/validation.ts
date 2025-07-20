// Simplified validation without external dependencies

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | undefined;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: { [field: string]: string };
  sanitizedData: { [field: string]: string };
}

/**
 * Sanitizes user input to prevent XSS and other attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove HTML tags and scripts (simple implementation)
  const cleaned = input.replace(/<[^>]*>/g, '');
  
  // Additional sanitization
  return cleaned
    .trim()
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .slice(0, 10000); // Prevent extremely long inputs
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
 * Common validation rules for AIM application
 */
export const ValidationRules = {
  screenName: [
    { required: true, message: 'Screen name is required' },
    { minLength: 3, message: 'Screen name must be at least 3 characters' },
    { maxLength: 16, message: 'Screen name must be less than 16 characters' },
    { 
      pattern: /^[a-zA-Z0-9_]+$/, 
      message: 'Screen name can only contain letters, numbers, and underscores' 
    }
  ],
  
  email: [
    { required: true, message: 'Email is required' },
    { 
      custom: (value: string) => {
        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
        return undefined;
      }
    }
  ],
  
  password: [
    { required: true, message: 'Password is required' },
    { minLength: 6, message: 'Password must be at least 6 characters' },
    { maxLength: 128, message: 'Password cannot exceed 128 characters' }
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
 * Validates and sanitizes multiple fields
 */
export function validateAndSanitizeData(
  data: { [field: string]: any },
  rules: { [field: string]: ValidationRule[] }
): ValidationResult {
  const errors: { [field: string]: string } = {};
  const sanitizedData: { [field: string]: string } = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const rawValue = data[field];
    const stringValue = typeof rawValue === 'string' ? rawValue : String(rawValue || '');
    const sanitizedValue = sanitizeInput(stringValue);
    
    sanitizedData[field] = sanitizedValue;
    
    const error = validateField(sanitizedValue, fieldRules);
    if (error) {
      errors[field] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
}

/**
 * Validates registration data
 */
export function validateRegistrationData(data: {
  screenName: string;
  email: string;
  password: string;
}): ValidationResult {
  return validateAndSanitizeData(data, {
    screenName: ValidationRules.screenName,
    email: ValidationRules.email,
    password: ValidationRules.password
  });
}

/**
 * Validates login data
 */
export function validateLoginData(data: {
  screenName: string;
  password: string;
}): ValidationResult {
  return validateAndSanitizeData(data, {
    screenName: ValidationRules.screenName,
    password: ValidationRules.password
  });
}

/**
 * Validates profile update data
 */
export function validateProfileData(data: {
  displayName?: string;
  location?: string;
  interests?: string;
  awayMessage?: string;
}): ValidationResult {
  const rules: { [field: string]: ValidationRule[] } = {};
  
  if (data.displayName !== undefined) {
    rules.displayName = ValidationRules.displayName;
  }
  if (data.location !== undefined) {
    rules.location = ValidationRules.location;
  }
  if (data.interests !== undefined) {
    rules.interests = ValidationRules.interests;
  }
  if (data.awayMessage !== undefined) {
    rules.awayMessage = ValidationRules.awayMessage;
  }
  
  return validateAndSanitizeData(data, rules);
}

/**
 * Validates message content
 */
export function validateMessageData(data: {
  content: string;
  toUserId: string;
}): ValidationResult {
  return validateAndSanitizeData(data, {
    content: ValidationRules.messageContent,
    toUserId: [
      { required: true, message: 'Recipient is required' },
      { 
        pattern: /^[a-f0-9-]{36}$/, 
        message: 'Invalid recipient ID format' 
      }
    ]
  });
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
  storage: Map<string, { count: number; resetTime: number }>
): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const record = storage.get(identifier);
  
  if (!record || now > record.resetTime) {
    // Reset or create new record
    storage.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return { allowed: true };
  }
  
  if (record.count >= maxRequests) {
    return { 
      allowed: false, 
      resetTime: record.resetTime 
    };
  }
  
  record.count++;
  return { allowed: true };
}

/**
 * Validates file upload
 */
export function validateFileUpload(
  file: { size: number; mimetype: string; originalname: string },
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): { isValid: boolean; error?: string } {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif']
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size cannot exceed ${Math.round(maxSize / 1024 / 1024)}MB`
    };
  }
  
  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `File type ${file.mimetype} is not allowed`
    };
  }
  
  // Check file extension
  const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    return {
      isValid: false,
      error: `File extension ${extension} is not allowed`
    };
  }
  
  return { isValid: true };
}
