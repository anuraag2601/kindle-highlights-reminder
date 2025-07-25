// Data Validation and Sanitization System
// Milestone 5: Production-ready data validation

class DataValidator {
  constructor() {
    this.schemas = this.initializeSchemas();
  }

  initializeSchemas() {
    return {
      book: {
        asin: { type: 'string', required: true, minLength: 10, maxLength: 20 },
        title: { type: 'string', required: true, minLength: 1, maxLength: 500 },
        author: { type: 'string', required: true, minLength: 1, maxLength: 200 },
        coverUrl: { type: 'string', required: false, maxLength: 2000 },
        lastUpdated: { type: 'number', required: false },
        highlightCount: { type: 'number', required: false, min: 0 }
      },
      highlight: {
        id: { type: 'string', required: true, minLength: 1 },
        bookAsin: { type: 'string', required: true, minLength: 10, maxLength: 20 },
        text: { type: 'string', required: true, minLength: 1, maxLength: 10000 },
        location: { type: 'string', required: false, maxLength: 100 },
        page: { type: 'string', required: false, maxLength: 20 },
        dateHighlighted: { type: 'number', required: false },
        dateAdded: { type: 'number', required: false },
        color: { type: 'string', required: false, enum: ['yellow', 'blue', 'pink', 'orange'] },
        note: { type: 'string', required: false, maxLength: 5000 },
        tags: { type: 'array', required: false, maxItems: 10 },
        timesShown: { type: 'number', required: false, min: 0 },
        lastShown: { type: 'number', required: false }
      },
      settings: {
        email: { type: 'email', required: false, maxLength: 255 },
        emailFrequency: { type: 'string', required: false, enum: ['daily', 'weekly', 'manual'] },
        emailTime: { type: 'string', required: false, pattern: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
        highlightsPerEmail: { type: 'number', required: false, min: 1, max: 50 },
        syncFrequency: { type: 'number', required: false, min: 1, max: 72 },
        enableAutoSync: { type: 'boolean', required: false },
        enableNotifications: { type: 'boolean', required: false },
        highlightSelectionMode: { 
          type: 'string', 
          required: false, 
          enum: ['spaced-repetition', 'random', 'oldest-first', 'newest-first', 'weighted-smart'] 
        }
      },
      emailRecord: {
        id: { type: 'string', required: true },
        recipient: { type: 'email', required: true },
        highlightCount: { type: 'number', required: true, min: 1 },
        sentAt: { type: 'number', required: true },
        status: { type: 'string', required: true, enum: ['sent', 'failed', 'pending'] },
        errorMessage: { type: 'string', required: false, maxLength: 1000 }
      }
    };
  }

  // Main validation method
  validate(data, schemaName) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      throw new Error(`Unknown schema: ${schemaName}`);
    }

    const errors = [];
    const sanitized = {};

    // Validate each field in the schema
    for (const [fieldName, rules] of Object.entries(schema)) {
      const value = data[fieldName];
      const fieldErrors = this.validateField(value, rules, fieldName);
      
      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
      } else if (value !== undefined) {
        sanitized[fieldName] = this.sanitizeValue(value, rules);
      }
    }

    // Check for extra fields not in schema
    for (const fieldName of Object.keys(data)) {
      if (!schema[fieldName]) {
        console.warn(`Unknown field in ${schemaName}: ${fieldName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
      original: data
    };
  }

  validateField(value, rules, fieldName) {
    const errors = [];

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName} is required`);
      return errors; // Skip other validations if required field is missing
    }

    // Skip validation if value is undefined/null and not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    if (!this.validateType(value, rules.type)) {
      errors.push(`${fieldName} must be of type ${rules.type}`);
      return errors; // Skip other validations if type is wrong
    }

    // String validations
    if (rules.type === 'string' || rules.type === 'email') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${fieldName} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${fieldName} must be no more than ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${fieldName} has invalid format`);
      }
    }

    // Email validation
    if (rules.type === 'email' && !this.isValidEmail(value)) {
      errors.push(`${fieldName} must be a valid email address`);
    }

    // Number validations
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${fieldName} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${fieldName} must be no more than ${rules.max}`);
      }
    }

    // Array validations
    if (rules.type === 'array') {
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push(`${fieldName} must have no more than ${rules.maxItems} items`);
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${fieldName} must be one of: ${rules.enum.join(', ')}`);
    }

    return errors;
  }

  validateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
      case 'email':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  sanitizeValue(value, rules) {
    if (rules.type === 'string' || rules.type === 'email') {
      return this.sanitizeString(value);
    }
    if (rules.type === 'array') {
      return this.sanitizeArray(value);
    }
    return value;
  }

  sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .trim() // Remove leading/trailing whitespace
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 10000); // Prevent extremely long strings
  }

  sanitizeArray(arr) {
    if (!Array.isArray(arr)) return arr;
    
    return arr
      .filter(item => item != null) // Remove null/undefined items
      .map(item => typeof item === 'string' ? this.sanitizeString(item) : item)
      .slice(0, 100); // Prevent extremely long arrays
  }

  // Batch validation for multiple items
  validateBatch(items, schemaName) {
    const results = items.map((item, index) => ({
      index,
      ...this.validate(item, schemaName)
    }));

    const valid = results.filter(r => r.isValid);
    const invalid = results.filter(r => !r.isValid);

    return {
      totalItems: items.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      validItems: valid.map(r => r.sanitized),
      invalidItems: invalid,
      success: invalid.length === 0
    };
  }

  // Sanitize HTML content (for notes and highlights)
  sanitizeHtml(html) {
    if (typeof html !== 'string') return '';
    
    // Remove potentially dangerous HTML tags and attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .trim();
  }

  // Validate import data
  validateImportData(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
      errors.push('Import data must be a valid JSON object');
      return { isValid: false, errors };
    }

    const { books = [], highlights = [] } = data;

    if (!Array.isArray(books)) {
      errors.push('Books data must be an array');
    }

    if (!Array.isArray(highlights)) {
      errors.push('Highlights data must be an array');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Validate individual items
    const bookValidation = this.validateBatch(books, 'book');
    const highlightValidation = this.validateBatch(highlights, 'highlight');

    return {
      isValid: bookValidation.success && highlightValidation.success,
      errors: [
        ...bookValidation.invalidItems.flatMap(item => item.errors),
        ...highlightValidation.invalidItems.flatMap(item => item.errors)
      ],
      books: bookValidation,
      highlights: highlightValidation,
      summary: {
        totalBooks: books.length,
        validBooks: bookValidation.validCount,
        totalHighlights: highlights.length,
        validHighlights: highlightValidation.validCount
      }
    };
  }

  // Create validation middleware for database operations
  createValidationMiddleware(schemaName) {
    return (data) => {
      const result = this.validate(data, schemaName);
      if (!result.isValid) {
        throw new Error(`Validation failed: ${result.errors.join(', ')}`);
      }
      return result.sanitized;
    };
  }
}

// Global validator instance
const dataValidator = new DataValidator();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataValidator, dataValidator };
} else if (typeof self !== 'undefined') {
  // Service Worker environment
  self.dataValidator = dataValidator;
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.dataValidator = dataValidator;
}