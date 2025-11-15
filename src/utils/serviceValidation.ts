import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

// Zod schemas for validation
export const serviceConfigurationSchema = z.record(z.unknown()).optional();

export const addServiceSchema = z.object({
  id: z.string().uuid({ message: "Invalid service ID format" }),
  name: z.string()
    .trim()
    .min(1, { message: "Service name cannot be empty" })
    .max(100, { message: "Service name must be less than 100 characters" }),
  base_price: z.number()
    .positive({ message: "Service price must be positive" })
    .max(10000, { message: "Service price cannot exceed $10,000" }),
  quantity: z.number()
    .int({ message: "Quantity must be a whole number" })
    .positive({ message: "Quantity must be at least 1" })
    .max(100, { message: "Quantity cannot exceed 100" }),
  configuration: serviceConfigurationSchema,
});

export const bookingIdSchema = z.string()
  .uuid({ message: "Invalid booking ID format" });

// Validation error types
export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

export type ValidationResult = {
  valid: boolean;
  errors?: ValidationError[];
};

/**
 * Comprehensive service validation utility
 * Validates services before database insertion
 */
export class ServiceValidator {
  /**
   * Validate service data structure
   */
  static validateServiceData(serviceData: any): ValidationResult {
    try {
      addServiceSchema.parse(serviceData);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: 'INVALID_FORMAT'
        }));
        return { valid: false, errors };
      }
      return {
        valid: false,
        errors: [{
          field: 'unknown',
          message: 'Validation failed',
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  /**
   * Validate booking ID format
   */
  static validateBookingId(bookingId: string): ValidationResult {
    try {
      bookingIdSchema.parse(bookingId);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: [{
            field: 'bookingId',
            message: error.errors[0].message,
            code: 'INVALID_BOOKING_ID'
          }]
        };
      }
      return {
        valid: false,
        errors: [{
          field: 'bookingId',
          message: 'Invalid booking ID',
          code: 'INVALID_BOOKING_ID'
        }]
      };
    }
  }

  /**
   * Check if service exists and is active in the database
   */
  static async validateServiceExists(serviceId: string): Promise<ValidationResult> {
    try {
      const { data: service, error } = await supabase
        .from('services')
        .select('id, name, is_active, is_visible')
        .eq('id', serviceId)
        .maybeSingle();

      if (error) {
        return {
          valid: false,
          errors: [{
            field: 'serviceId',
            message: `Database error: ${error.message}`,
            code: 'DB_ERROR'
          }]
        };
      }

      if (!service) {
        return {
          valid: false,
          errors: [{
            field: 'serviceId',
            message: 'Service not found in database',
            code: 'SERVICE_NOT_FOUND'
          }]
        };
      }

      if (!service.is_active) {
        return {
          valid: false,
          errors: [{
            field: 'serviceId',
            message: `Service "${service.name}" is currently inactive and cannot be added`,
            code: 'SERVICE_INACTIVE'
          }]
        };
      }

      if (!service.is_visible) {
        return {
          valid: false,
          errors: [{
            field: 'serviceId',
            message: `Service "${service.name}" is not available for booking`,
            code: 'SERVICE_HIDDEN'
          }]
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'serviceId',
          message: 'Failed to verify service',
          code: 'VERIFICATION_FAILED'
        }]
      };
    }
  }

  /**
   * Check if booking exists and is in valid state for adding services
   */
  static async validateBookingState(bookingId: string): Promise<ValidationResult> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('id, status, payment_status, is_archived')
        .eq('id', bookingId)
        .maybeSingle();

      if (error) {
        return {
          valid: false,
          errors: [{
            field: 'bookingId',
            message: `Database error: ${error.message}`,
            code: 'DB_ERROR'
          }]
        };
      }

      if (!booking) {
        return {
          valid: false,
          errors: [{
            field: 'bookingId',
            message: 'Booking not found',
            code: 'BOOKING_NOT_FOUND'
          }]
        };
      }

      if (booking.is_archived) {
        return {
          valid: false,
          errors: [{
            field: 'bookingId',
            message: 'Cannot add services to an archived booking',
            code: 'BOOKING_ARCHIVED'
          }]
        };
      }

      if (booking.status === 'cancelled') {
        return {
          valid: false,
          errors: [{
            field: 'bookingId',
            message: 'Cannot add services to a cancelled booking',
            code: 'BOOKING_CANCELLED'
          }]
        };
      }

      if (booking.status === 'completed') {
        return {
          valid: false,
          errors: [{
            field: 'bookingId',
            message: 'Cannot add services to a completed booking. Please create a new booking.',
            code: 'BOOKING_COMPLETED'
          }]
        };
      }

      // Payment authorization check
      if (booking.status === 'pending' && !booking.payment_status) {
        return {
          valid: false,
          errors: [{
            field: 'bookingId',
            message: 'Booking must have payment authorization before adding services',
            code: 'NO_PAYMENT_AUTH'
          }]
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'bookingId',
          message: 'Failed to verify booking state',
          code: 'VERIFICATION_FAILED'
        }]
      };
    }
  }

  /**
   * Check for duplicate service with same configuration
   */
  static async validateNoDuplicate(
    bookingId: string,
    serviceId: string,
    configuration: any
  ): Promise<ValidationResult> {
    try {
      const configString = JSON.stringify(configuration || {});
      
      const { data: existingService, error } = await supabase
        .from('booking_services')
        .select('id, service_name, quantity')
        .eq('booking_id', bookingId)
        .eq('service_id', serviceId)
        .eq('configuration', configString)
        .maybeSingle();

      if (error) {
        return {
          valid: false,
          errors: [{
            field: 'duplicate',
            message: `Database error: ${error.message}`,
            code: 'DB_ERROR'
          }]
        };
      }

      if (existingService) {
        return {
          valid: false,
          errors: [{
            field: 'duplicate',
            message: `Service "${existingService.service_name}" with this configuration already exists (quantity: ${existingService.quantity}). Use update instead.`,
            code: 'DUPLICATE_SERVICE'
          }]
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'duplicate',
          message: 'Failed to check for duplicates',
          code: 'VERIFICATION_FAILED'
        }]
      };
    }
  }

  /**
   * Comprehensive validation: runs all checks
   */
  static async validateServiceAddition(
    bookingId: string,
    serviceData: any,
    skipDuplicateCheck: boolean = false
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // 1. Validate booking ID format
    const bookingIdResult = this.validateBookingId(bookingId);
    if (!bookingIdResult.valid) {
      errors.push(...(bookingIdResult.errors || []));
      return { valid: false, errors }; // Stop if booking ID is invalid
    }

    // 2. Validate service data structure
    const dataResult = this.validateServiceData(serviceData);
    if (!dataResult.valid) {
      errors.push(...(dataResult.errors || []));
      return { valid: false, errors }; // Stop if data structure is invalid
    }

    // 3. Validate service exists and is active (async)
    const serviceExistsResult = await this.validateServiceExists(serviceData.id);
    if (!serviceExistsResult.valid) {
      errors.push(...(serviceExistsResult.errors || []));
    }

    // 4. Validate booking state (async)
    const bookingStateResult = await this.validateBookingState(bookingId);
    if (!bookingStateResult.valid) {
      errors.push(...(bookingStateResult.errors || []));
    }

    // 5. Check for duplicates (async) - optional
    if (!skipDuplicateCheck) {
      const duplicateResult = await this.validateNoDuplicate(
        bookingId,
        serviceData.id,
        serviceData.configuration
      );
      if (!duplicateResult.valid) {
        errors.push(...(duplicateResult.errors || []));
      }
    }

    return errors.length > 0 
      ? { valid: false, errors }
      : { valid: true };
  }

  /**
   * Format validation errors for display
   */
  static formatErrors(errors: ValidationError[]): string {
    if (errors.length === 0) return 'Validation failed';
    if (errors.length === 1) return errors[0].message;
    
    return errors
      .map((err, idx) => `${idx + 1}. ${err.message}`)
      .join('\n');
  }
}
