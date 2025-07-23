import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, Info } from 'lucide-react';
import { getBookingStatusForDisplay, BookingStatus } from '@/utils/statusUtils';

interface BookingStatusDisplayProps {
  booking: {
    id: string;
    status: string;
    payment_status: string;
    payment_intent_id?: string;
    created_at: string;
    scheduled_date: string;
    scheduled_start: string;
  };
  showDetails?: boolean;
}

export const BookingStatusDisplay: React.FC<BookingStatusDisplayProps> = ({ 
  booking, 
  showDetails = false 
}) => {
  const statusInfo: BookingStatus = getBookingStatusForDisplay(
    booking.status, 
    booking.payment_status
  );

  const getStatusIcon = () => {
    switch (statusInfo.status_color) {
      case 'green':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'yellow':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'red':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'blue':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColorClass = () => {
    switch (statusInfo.status_color) {
      case 'green':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'red':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'blue':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!showDetails) {
    return (
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <Badge className={getStatusColorClass()}>
          {statusInfo.display_status}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Booking Status</span>
          <Badge className={getStatusColorClass()}>
            {statusInfo.display_status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start space-x-3">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {statusInfo.user_message}
            </p>
            {statusInfo.action_required && (
              <p className="text-xs text-orange-600 mt-1">
                Action Required
              </p>
            )}
          </div>
        </div>

        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Booking ID:</span>
                <span className="ml-2 font-mono text-xs">{booking.id}</span>
              </div>
              <div>
                <span className="text-gray-500">Payment Status:</span>
                <span className="ml-2 capitalize">{booking.payment_status}</span>
              </div>
              <div>
                <span className="text-gray-500">Booking Status:</span>
                <span className="ml-2 capitalize">{booking.status}</span>
              </div>
              {booking.payment_intent_id && (
                <div>
                  <span className="text-gray-500">Payment ID:</span>
                  <span className="ml-2 font-mono text-xs">
                    {booking.payment_intent_id.substring(0, 20)}...
                  </span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Created: {new Date(booking.created_at).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              Scheduled: {new Date(`${booking.scheduled_date}T${booking.scheduled_start}`).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};