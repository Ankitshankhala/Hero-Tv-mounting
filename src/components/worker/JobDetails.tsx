
import { Calendar, MapPin, Clock, Phone } from 'lucide-react';
import { formatBookingTimeForContext, getUserTimezone, getTimezoneAbbreviation } from '@/utils/timeUtils';
import { format } from 'date-fns';

interface JobDetailsProps {
  job: any;
}

const JobDetails = ({ job }: JobDetailsProps) => {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}hr ${mins > 0 ? `${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  // Get timezone-aware formatted time for worker context
  const workerTimezone = getUserTimezone();
  const serviceTimezone = job.service_tz || 'America/Chicago';
  const formattedDateTime = formatBookingTimeForContext(job, 'worker', workerTimezone);
  
  // Show timezone info if worker is in different timezone than service
  const showTimezoneInfo = workerTimezone !== serviceTimezone;
  const timezoneLabel = showTimezoneInfo ? getTimezoneAbbreviation(workerTimezone) : '';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center space-x-2 text-slate-300">
          <Calendar className="h-4 w-4" />
          <div className="flex flex-col">
            <span>{formattedDateTime}</span>
            {showTimezoneInfo && (
              <span className="text-xs text-slate-400">
                Your timezone ({timezoneLabel})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(job.total_duration_minutes || job.service?.duration_minutes || 60)}</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <Phone className="h-4 w-4" />
          <span>{job.customer?.phone || job.guest_customer_info?.phone || 'No phone'}</span>
        </div>
      </div>

      <div className="flex items-start space-x-2 mb-4 text-slate-300">
        <MapPin className="h-4 w-4 mt-0.5" />
        <span>{job.customer_address || job.location_notes || 'No address provided'}</span>
      </div>
    </>
  );
};

export default JobDetails;
