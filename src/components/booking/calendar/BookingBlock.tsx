
import React from 'react';
import { User } from 'lucide-react';

interface Booking {
  id: string;
  services: any;
  worker: { name: string } | null;
}

interface BookingBlockProps {
  booking: Booking;
}

export const BookingBlock = ({ booking }: BookingBlockProps) => {
  const formatServices = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => s.name).join(', ');
    }
    return 'Service';
  };

  return (
    <div className="bg-red-600 text-white text-xs p-1 rounded mb-1 opacity-75">
      <div className="flex items-center space-x-1">
        <User className="h-3 w-3" />
        <span className="truncate">
          {booking.worker?.name || 'Worker'}
        </span>
      </div>
      <div className="truncate">
        {formatServices(booking.services)}
      </div>
    </div>
  );
};
