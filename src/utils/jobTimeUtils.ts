import { convertUTCToLocal } from './timezoneUtils';
import { fromZonedTime } from 'date-fns-tz';

/**
 * Central utility to get the canonical start time for a booking in UTC
 * Follows the priority order: start_time_utc -> local_service_date+time -> scheduled_date+start
 */
export const getBookingStartUtc = (booking: any): Date | null => {
  // Priority 1: Use start_time_utc if available
  if (booking.start_time_utc) {
    try {
      return new Date(booking.start_time_utc);
    } catch (error) {
      console.warn('Invalid start_time_utc:', booking.start_time_utc);
    }
  }

  // Priority 2: Use local_service_date + local_service_time with service_tz
  if (booking.local_service_date && booking.local_service_time) {
    const serviceTimezone = booking.service_tz || booking.service?.timezone || 'America/Chicago';
    try {
      // Convert local service time to UTC properly using fromZonedTime
      const localDateTime = `${booking.local_service_date} ${booking.local_service_time}`;
      return fromZonedTime(localDateTime, serviceTimezone);
    } catch (error) {
      console.warn('Invalid local_service_date/time:', booking.local_service_date, booking.local_service_time);
    }
  }

  // Priority 3: Fallback to scheduled_date + scheduled_start
  if (booking.scheduled_date && booking.scheduled_start) {
    const serviceTimezone = booking.service_tz || booking.service?.timezone || 'America/Chicago';
    try {
      const dateTimeString = `${booking.scheduled_date} ${booking.scheduled_start}`;
      return fromZonedTime(dateTimeString, serviceTimezone);
    } catch (error) {
      console.warn('Invalid scheduled_date/start:', booking.scheduled_date, booking.scheduled_start);
    }
  }

  // Legacy fallbacks
  if (booking.preferred_start_time) {
    try {
      return new Date(booking.preferred_start_time);
    } catch (error) {
      console.warn('Invalid preferred_start_time:', booking.preferred_start_time);
    }
  }

  if (booking.start_time) {
    try {
      return new Date(booking.start_time);
    } catch (error) {
      console.warn('Invalid start_time:', booking.start_time);
    }
  }

  return null;
};

/**
 * Get the display timezone for a booking
 */
export const getBookingTimezone = (booking: any): string => {
  return booking.service_tz || booking.service?.timezone || 'America/Chicago';
};

/**
 * Check if a booking is scheduled for today in its service timezone
 */
export const isBookingToday = (booking: any): boolean => {
  const startTime = getBookingStartUtc(booking);
  if (!startTime) return false;

  const timezone = getBookingTimezone(booking);
  
  try {
    // Convert UTC time to local service time for comparison
    const localTime = convertUTCToLocal(startTime, timezone);
    const localDate = new Date(`${localTime.date}T${localTime.time}`);
    
    // Get today in the same timezone
    const now = new Date();
    const todayLocal = convertUTCToLocal(now, timezone);
    const today = new Date(`${todayLocal.date}T00:00:00`);
    const tomorrow = new Date(today.getTime() + 86400000);
    
    return localDate >= today && localDate < tomorrow;
  } catch (error) {
    console.warn('Error checking if booking is today:', error);
    return false;
  }
};

/**
 * Calculate minutes until booking starts
 */
export const getMinutesUntilStart = (booking: any): number | null => {
  const startTime = getBookingStartUtc(booking);
  if (!startTime) return null;

  const now = new Date();
  return Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
};