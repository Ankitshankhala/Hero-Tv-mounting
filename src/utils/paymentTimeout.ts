/**
 * Payment Timeout Utilities
 * Provides timeout wrappers for payment operations to prevent indefinite hangs
 */

export class PaymentTimeoutError extends Error {
  constructor(operation: string, timeout: number) {
    super(`${operation} took longer than ${timeout}ms. Please try again.`);
    this.name = 'PaymentTimeoutError';
  }
}

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name of the operation for error message
 * @returns Promise that rejects if timeout is exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new PaymentTimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Default timeout for payment intent creation (15 seconds)
 */
export const PAYMENT_INTENT_TIMEOUT = 15000;

/**
 * Default timeout for card confirmation (15 seconds)
 */
export const CARD_CONFIRMATION_TIMEOUT = 15000;

/**
 * Wraps Supabase function invocation with timeout
 */
export async function invokeWithTimeout<T>(
  invokeFn: () => Promise<T>,
  operationName: string,
  timeoutMs: number = PAYMENT_INTENT_TIMEOUT
): Promise<T> {
  return withTimeout(invokeFn(), timeoutMs, operationName);
}
