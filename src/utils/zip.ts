/**
 * Central ZIP code normalization & validation helpers.
 * ZIP codes MUST always be 5-digit strings end-to-end.
 * Never store as a number, never truncate to fewer than 5 digits.
 */

/**
 * Strip non-digits and cap to 5. Accepts any input (string, number, null, undefined).
 * Returns "" if the input has no digits.
 */
export const cleanZip = (input: unknown): string => {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\D/g, '').slice(0, 5);
};

/**
 * True only if the cleaned input is exactly 5 digits.
 */
export const isValidZip = (input: unknown): boolean => {
  return /^\d{5}$/.test(cleanZip(input));
};

/**
 * Returns the cleaned 5-digit ZIP or throws a descriptive error.
 * Use this immediately before any RPC / Supabase insert / external API call.
 */
export const assertValidZip = (input: unknown, context = 'operation'): string => {
  const cleaned = cleanZip(input);
  if (!/^\d{5}$/.test(cleaned)) {
    throw new Error(
      `Invalid ZIP code format for ${context}: "${String(input ?? '')}" (cleaned: "${cleaned}", length: ${cleaned.length})`
    );
  }
  return cleaned;
};
