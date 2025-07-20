import { describe, it, expect } from 'vitest';
import {
  validateField,
  validateForm,
  ValidationRules,
  validateScreenName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateMessage,
  sanitizeInput,
  validateAndSanitize
} from '../validation';

describe('Validation Utils', () => {
  describe('validateField', () => {
    it('should validate required fields', () => {
      const rules = [{ required: true, message: 'Field is required' }];
      
      expect(validateField('', rules)).toBe('Field is required');
      expect(validateField('   ', rules)).toBe('Field is required');
      expect(validateField('value', rules)).toBeUndefined();
    });

    it('should validate minimum length', () => {
      const rules = [{ minLength: 3, message: 'Too short' }];
      
      expect(validateField('ab', rules)).toBe('Too short');
      expect(validateField('abc', rules)).toBeUndefined();
      expect(validateField('abcd', rules)).toBeUndefined();
    });

    it('should validate maximum length', () => {
      const rules = [{ maxLength: 5, message: 'Too long' }];
      
      expect(validateField('abcdef', rules)).toBe('Too long');
      expect(validateField('abcde', rules)).toBeUndefined();
      expect(validateField('abc', rules)).toBeUndefined();
    });

    it('should validate patterns', () => {
      const rules = [{ pattern: /^[a-zA-Z]+$/, message: 'Letters only' }];
      
      expect(validateField('abc123', rules)).toBe('Letters only');
      expect(validateField('abc', rules)).toBeUndefined();
    });

    it('should validate with custom functions', () => {
      const rules = [{
        custom: (value: string) => value === 'forbidden' ? 'Value not allowed' : undefined
      }];
      
      expect(validateField('forbidden', rules)).toBe('Value not allowed');
      expect(validateField('allowed', rules)).toBeUndefined();
    });

    it('should skip validations for empty non-required fields', () => {
      const rules = [
        { minLength: 3, message: 'Too short' },
        { pattern: /^[a-zA-Z]+$/, message: 'Letters only' }
      ];
      
      expect(validateField('', rules)).toBeUndefined();
      expect(validateField('   ', rules)).toBeUndefined();
    });
  });

  describe('validateForm', () => {
    it('should validate multiple fields', () => {
      const data = {
        screenName: 'ab',
        email: 'invalid-email',
        password: '123'
      };
      
      const rules = {
        screenName: ValidationRules.screenName,
        email: ValidationRules.email,
        password: ValidationRules.password
      };
      
      const result = validateForm(data, rules);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.screenName).toContain('at least 3 characters');
      expect(result.errors.email).toContain('valid email address');
      expect(result.errors.password).toContain('at least 6 characters');
    });

    it('should return valid result for correct data', () => {
      const data = {
        screenName: 'validuser',
        email: 'user@example.com',
        password: 'password123'
      };
      
      const rules = {
        screenName: ValidationRules.screenName,
        email: ValidationRules.email,
        password: ValidationRules.password
      };
      
      const result = validateForm(data, rules);
      
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });
  });

  describe('validateScreenName', () => {
    it('should validate screen name requirements', () => {
      expect(validateScreenName('')).toContain('required');
      expect(validateScreenName('ab')).toContain('at least 3 characters');
      expect(validateScreenName('a'.repeat(51))).toContain('less than 50 characters');
      expect(validateScreenName('user@name')).toContain('letters, numbers, underscores, and hyphens');
      expect(validateScreenName('valid_user-123')).toBeUndefined();
    });
  });

  describe('validateEmail', () => {
    it('should validate email addresses', () => {
      expect(validateEmail('')).toContain('required');
      expect(validateEmail('invalid')).toContain('valid email address');
      expect(validateEmail('user@')).toContain('valid email address');
      expect(validateEmail('@domain.com')).toContain('valid email address');
      expect(validateEmail('user@domain')).toContain('valid email address');
      expect(validateEmail('user@domain.com')).toBeUndefined();
    });
  });

  describe('validatePassword', () => {
    it('should validate password requirements', () => {
      expect(validatePassword('')).toContain('required');
      expect(validatePassword('123')).toContain('at least 6 characters');
      expect(validatePassword('password123')).toBeUndefined();
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('should validate password confirmation', () => {
      expect(validatePasswordConfirmation('password', '')).toContain('confirm your password');
      expect(validatePasswordConfirmation('password', 'different')).toContain('do not match');
      expect(validatePasswordConfirmation('password', 'password')).toBeUndefined();
    });
  });

  describe('validateMessage', () => {
    it('should validate message content', () => {
      expect(validateMessage('')).toContain('cannot be empty');
      expect(validateMessage('a'.repeat(2001))).toContain('cannot exceed 2000 characters');
      expect(validateMessage('Valid message')).toBeUndefined();
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeInput('<div>content</div>')).toBe('content');
      expect(sanitizeInput('<>test')).toBe('test');
    });

    it('should remove javascript protocols', () => {
      expect(sanitizeInput('javascript:alert("xss")')).toBe('alert("xss")');
      expect(sanitizeInput('JAVASCRIPT:alert("xss")')).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      expect(sanitizeInput('onclick=alert("xss")')).toBe('');
      expect(sanitizeInput('onload=malicious()')).toBe('');
      expect(sanitizeInput('ONCLICK=alert("xss")')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
      expect(sanitizeInput('\n\ttest\n\t')).toBe('test');
    });

    it('should handle normal text', () => {
      expect(sanitizeInput('Normal text content')).toBe('Normal text content');
      expect(sanitizeInput('Text with numbers 123')).toBe('Text with numbers 123');
    });
  });

  describe('validateAndSanitize', () => {
    it('should validate and sanitize input', () => {
      const rules = [
        { required: true },
        { minLength: 3 }
      ];
      
      const result1 = validateAndSanitize('  <script>test</script>  ', rules);
      expect(result1.isValid).toBe(true);
      expect(result1.value).toBe('test');
      
      const result2 = validateAndSanitize('  ab  ', rules);
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('at least 3 characters');
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeInput(123 as any)).toBe('123');
      expect(sanitizeInput(true as any)).toBe('true');
      expect(sanitizeInput({} as any)).toBe('[object Object]');
    });

    it('should handle empty validation rules', () => {
      expect(validateField('test', [])).toBeUndefined();
    });

    it('should handle missing fields in form validation', () => {
      const data = { screenName: 'test' };
      const rules = { 
        screenName: ValidationRules.screenName,
        email: ValidationRules.email 
      };
      
      const result = validateForm(data, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('required');
    });
  });

  describe('complex validation scenarios', () => {
    it('should validate registration form data', () => {
      const validData = {
        screenName: 'testuser123',
        email: 'test@example.com',
        password: 'securepassword',
        confirmPassword: 'securepassword'
      };
      
      const screenNameError = validateScreenName(validData.screenName);
      const emailError = validateEmail(validData.email);
      const passwordError = validatePassword(validData.password);
      const confirmError = validatePasswordConfirmation(validData.password, validData.confirmPassword);
      
      expect(screenNameError).toBeUndefined();
      expect(emailError).toBeUndefined();
      expect(passwordError).toBeUndefined();
      expect(confirmError).toBeUndefined();
    });

    it('should validate profile update data', () => {
      const profileData = {
        displayName: 'Test User',
        location: 'Test City',
        interests: 'Testing, Validation',
        awayMessage: 'Away for testing'
      };
      
      const rules = {
        displayName: ValidationRules.displayName,
        location: ValidationRules.location,
        interests: ValidationRules.interests,
        awayMessage: ValidationRules.awayMessage
      };
      
      const result = validateForm(profileData, rules);
      expect(result.isValid).toBe(true);
    });
  });
});
