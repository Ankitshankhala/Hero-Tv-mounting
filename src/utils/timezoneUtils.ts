
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Timezone utility functions for handling booking times across different timezones
 */

// Default service timezone for the business
export const DEFAULT_SERVICE_TIMEZONE = 'America/Chicago';

// Common US timezones for admin views
export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
] as const;

/**
 * Format a UTC timestamp for display in a specific timezone
 */
export const formatBookingTime = (
  utcTimestamp: string | Date,
  displayTimezone: string,
  options: {
    showDate?: boolean;
    showTime?: boolean;
    showTimezone?: boolean;
    dateFormat?: string;
    timeFormat?: string;
  } = {}
) => {
  const {
    showDate = true,
    showTime = true,
    showTimezone = false,
    dateFormat = 'MMM dd, yyyy',
    timeFormat = 'h:mm a'
  } = options;

  if (!utcTimestamp) {
    return 'Invalid date';
  }

  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;

  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const parts = [];

  if (showDate) {
    parts.push(formatInTimeZone(date, displayTimezone, dateFormat));
  }

  if (showTime) {
    parts.push(formatInTimeZone(date, displayTimezone, timeFormat));
  }

  let result = parts.join(' ');

  if (showTimezone) {
    const tzAbbr = formatInTimeZone(date, displayTimezone, 'zzz');
    result += ` ${tzAbbr}`;
  }

  return result;
};

/**
 * Get the timezone abbreviation for a given IANA timezone
 */
export const getTimezoneAbbreviation = (timezone: string, date: Date = new Date()): string => {
  try {
    return formatInTimeZone(date, timezone, 'zzz');
  } catch (error) {
    console.warn('Invalid timezone:', timezone);
    return timezone;
  }
};

/**
 * Convert local service date/time to UTC
 */
export const convertLocalToUTC = (
  localDate: string,
  localTime: string,
  serviceTimezone: string
): Date => {
  const localDateTime = `${localDate} ${localTime}`;
  const localTimestamp = new Date(`${localDateTime}T00:00:00`);
  
  // Convert local service time to UTC
  return fromZonedTime(localTimestamp, serviceTimezone);
};

/**
 * Convert UTC timestamp to local service timezone
 */
export const convertUTCToLocal = (
  utcTimestamp: string | Date,
  serviceTimezone: string
): { date: string; time: string } => {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : utcTimestamp;
  const localDate = toZonedTime(date, serviceTimezone);
  
  return {
    date: format(localDate, 'yyyy-MM-dd'),
    time: format(localDate, 'HH:mm')
  };
};

/**
 * Get the user's browser timezone
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not detect user timezone, falling back to Central Time');
    return DEFAULT_SERVICE_TIMEZONE;
  }
};

/**
 * Check if a timezone is valid
 */
export const isValidTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Format booking time for different contexts
 */
export const formatBookingTimeForContext = (
  booking: any,
  context: 'worker' | 'admin' | 'customer',
  viewerTimezone?: string
) => {
  // Use start_time_utc if available, fallback to constructed UTC time
  let utcTime: Date;
  
  if (booking.start_time_utc) {
    utcTime = new Date(booking.start_time_utc);
  } else if (booking.local_service_date && booking.local_service_time && booking.service_tz) {
    // Construct UTC from local fields
    const localDateTime = `${booking.local_service_date} ${booking.local_service_time}`;
    utcTime = fromZonedTime(new Date(`${localDateTime}T00:00:00`), booking.service_tz);
  } else {
    // Fallback to legacy fields
    const legacyDateTime = `${booking.scheduled_date} ${booking.scheduled_start}`;
    utcTime = fromZonedTime(new Date(`${legacyDateTime}T00:00:00`), booking.service_tz || DEFAULT_SERVICE_TIMEZONE);
  }

  const serviceTimezone = booking.service_tz || DEFAULT_SERVICE_TIMEZONE;
  
  switch (context) {
    case 'customer':
      // Always show in service timezone for customers
      return formatBookingTime(utcTime, serviceTimezone, {
        showTimezone: false
      });
      
    case 'worker':
      // Show in worker's timezone if different from service timezone
      const workerTz = viewerTimezone || getUserTimezone();
      const showTz = workerTz !== serviceTimezone;
      return formatBookingTime(utcTime, workerTz, {
        showTimezone: showTz
      });
      
    case 'admin':
      // Admin can choose display timezone, default to service timezone
      const adminTz = viewerTimezone || serviceTimezone;
      return formatBookingTime(utcTime, adminTz, {
        showTimezone: true
      });
      
    default:
      return formatBookingTime(utcTime, serviceTimezone);
  }
};
