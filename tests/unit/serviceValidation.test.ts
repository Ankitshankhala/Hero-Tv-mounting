import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceValidator } from '@/utils/serviceValidation';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('ServiceValidator', () => {
  describe('validateServiceData', () => {
    it('should accept valid service data', () => {
      const validService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Mount TV',
        base_price: 199.99,
        quantity: 1,
        configuration: {}
      };

      const result = ServiceValidator.validateServiceData(validService);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject service with invalid UUID', () => {
      const invalidService = {
        id: 'not-a-uuid',
        name: 'Mount TV',
        base_price: 199.99,
        quantity: 1
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].code).toBe('INVALID_FORMAT');
    });

    it('should reject service with negative price', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Mount TV',
        base_price: -10,
        quantity: 1
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('positive');
    });

    it('should reject service with price > $10,000', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Mount TV',
        base_price: 15000,
        quantity: 1
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('10,000');
    });

    it('should reject service with zero quantity', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Mount TV',
        base_price: 199.99,
        quantity: 0
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('at least 1');
    });

    it('should reject service with quantity > 100', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Mount TV',
        base_price: 199.99,
        quantity: 150
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('100');
    });

    it('should reject service with empty name', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: '   ',
        base_price: 199.99,
        quantity: 1
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('empty');
    });

    it('should reject service with name > 100 chars', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'A'.repeat(150),
        base_price: 199.99,
        quantity: 1
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('100 characters');
    });

    it('should accept fractional quantity (should fail - must be integer)', () => {
      const invalidService = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Mount TV',
        base_price: 199.99,
        quantity: 1.5
      };

      const result = ServiceValidator.validateServiceData(invalidService);
      expect(result.valid).toBe(false);
      expect(result.errors![0].message).toContain('whole number');
    });
  });

  describe('validateBookingId', () => {
    it('should accept valid UUID', () => {
      const result = ServiceValidator.validateBookingId('123e4567-e89b-12d3-a456-426614174000');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const result = ServiceValidator.validateBookingId('not-a-uuid');
      expect(result.valid).toBe(false);
      expect(result.errors![0].code).toBe('INVALID_BOOKING_ID');
    });

    it('should reject empty string', () => {
      const result = ServiceValidator.validateBookingId('');
      expect(result.valid).toBe(false);
    });
  });

  describe('formatErrors', () => {
    it('should format single error', () => {
      const errors = [
        { field: 'name', message: 'Name is required', code: 'REQUIRED' }
      ];
      const formatted = ServiceValidator.formatErrors(errors);
      expect(formatted).toBe('Name is required');
    });

    it('should format multiple errors as numbered list', () => {
      const errors = [
        { field: 'name', message: 'Name is required', code: 'REQUIRED' },
        { field: 'price', message: 'Price must be positive', code: 'INVALID' }
      ];
      const formatted = ServiceValidator.formatErrors(errors);
      expect(formatted).toContain('1. Name is required');
      expect(formatted).toContain('2. Price must be positive');
    });

    it('should handle empty errors array', () => {
      const formatted = ServiceValidator.formatErrors([]);
      expect(formatted).toBe('Validation failed');
    });
  });
});
