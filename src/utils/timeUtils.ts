
import { format, parseISO, isValid } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Converts 24-hour time format to 12-hour format with AM/PM
 * @param time24 - Time in 24-hour format (e.g., "09:00", "14:30")
 * @returns Time in 12-hour format with AM/PM (e.g., "9:00 AM", "2:30 PM")
 */
export const formatTimeTo12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Default timezone for service operations
 */
export const DEFAULT_SERVICE_TIMEZONE = 'America/Chicago';

/**
 * Common US timezones with display labels
 */
export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' }
];

/**
 * Formats a booking time for display in a specified timezone
 */
export const formatBookingTime = (
  utcTimestamp: string | Date,
  displayTimezone: string,
  options?: {
    showDate?: boolean;
    showTime?: boolean;
    showTimezone?: boolean;
    dateFormat?: string;
    timeFormat?: string;
  }
): string => {
  const {
    showDate = true,
    showTime = true,
    showTimezone = false,
    dateFormat = 'MMM d, yyyy',
    timeFormat = 'h:mm a'
  } = options || {};

  const date = typeof utcTimestamp === 'string' ? parseISO(utcTimestamp) : utcTimestamp;
  
  if (!isValid(date)) {
    return 'Invalid date';
  }

  const parts: string[] = [];

  if (showDate) {
    parts.push(formatInTimeZone(date, displayTimezone, dateFormat));
  }

  if (showTime) {
    parts.push(formatInTimeZone(date, displayTimezone, timeFormat));
  }

  if (showTimezone) {
    const abbr = getTimezoneAbbreviation(displayTimezone, date);
    parts.push(`(${abbr})`);
  }

  return parts.join(' ');
};

/**
 * Gets the timezone abbreviation for a given IANA timezone
 */
export const getTimezoneAbbreviation = (timezone: string, date: Date = new Date()): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || timezone;
  } catch {
    return timezone;
  }
};

/**
 * Converts a local date and time in a given timezone to a UTC Date object
 */
export const convertLocalToUTC = (localDate: string, localTime: string, serviceTimezone: string): Date => {
  const localDateTime = `${localDate}T${localTime}`;
  return fromZonedTime(localDateTime, serviceTimezone);
};

/**
 * Converts a UTC timestamp to local date and time in the specified timezone
 */
export const convertUTCToLocal = (utcTimestamp: string | Date, serviceTimezone: string): { date: string; time: string } => {
  const date = typeof utcTimestamp === 'string' ? parseISO(utcTimestamp) : utcTimestamp;
  const zonedDate = toZonedTime(date, serviceTimezone);
  
  return {
    date: format(zonedDate, 'yyyy-MM-dd'),
    time: format(zonedDate, 'HH:mm')
  };
};

/**
 * Detects and returns the user's browser timezone
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return DEFAULT_SERVICE_TIMEZONE;
  }
};

/**
 * Checks if a given timezone string is valid
 */
export const isValidTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Formats booking times based on context (customer, worker, admin)
 */
export const formatBookingTimeForContext = (
  booking: any,
  context: 'worker' | 'admin' | 'customer',
  viewerTimezone?: string
): string => {
  const timezone = viewerTimezone || getUserTimezone();
  
  // Handle different ways booking times might be stored
  const timestamp = booking.scheduledDateTime || booking.scheduled_date_time || booking.dateTime;
  
  if (!timestamp) {
    return 'No time set';
  }

  switch (context) {
    case 'customer':
      return formatBookingTime(timestamp, timezone, {
        showDate: true,
        showTime: true,
        showTimezone: true
      });
    
    case 'worker':
      return formatBookingTime(timestamp, timezone, {
        showDate: true,
        showTime: true,
        showTimezone: false
      });
    
    case 'admin':
      return formatBookingTime(timestamp, DEFAULT_SERVICE_TIMEZONE, {
        showDate: true,
        showTime: true,
        showTimezone: true
      });
    
    default:
      return formatBookingTime(timestamp, timezone);
  }
};
