
import React from 'react';
import { Calendar, MapPin, Clock, Phone } from 'lucide-react';

interface JobDetailsProps {
  job: any;
}

const JobDetails = ({ job }: JobDetailsProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}hr ${mins > 0 ? `${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center space-x-2 text-slate-300">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(job.scheduled_at)} at {formatTime(job.scheduled_at)}</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(job.total_duration_minutes)}</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-300">
          <Phone className="h-4 w-4" />
          <span>{job.customer?.phone || 'No phone'}</span>
        </div>
      </div>

      <div className="flex items-start space-x-2 mb-4 text-slate-300">
        <MapPin className="h-4 w-4 mt-0.5" />
        <span>{job.customer_address}</span>
      </div>
    </>
  );
};

export default JobDetails;
