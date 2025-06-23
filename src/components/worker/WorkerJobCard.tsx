
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, User, Phone, Mail, DollarSign } from 'lucide-react';
import { PaymentCaptureButton } from './PaymentCaptureButton';

interface WorkerJobCardProps {
  job: {
    id: string;
    scheduled_date: string;
    scheduled_start: string;
    status: string;
    payment_status?: string;
    location_notes?: string;
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    service?: {
      name?: string;
      base_price?: number;
    };
  };
  onStatusUpdate?: () => void;
}

export const WorkerJobCard = ({ job, onStatusUpdate }: WorkerJobCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'authorized': return 'bg-purple-500';
      case 'in_progress': return 'bg-orange-500';
      case 'completed': return 'bg-green-500';
      case 'captured': return 'bg-green-600';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'pending': return 'bg-yellow-500';
      case 'authorized': return 'bg-purple-500';
      case 'captured': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'expired': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{job.service?.name || 'Service'}</CardTitle>
          <div className="flex flex-col space-y-2">
            <Badge className={`${getStatusColor(job.status)} text-white`}>
              {job.status}
            </Badge>
            {job.payment_status && (
              <Badge className={`${getPaymentStatusColor(job.payment_status)} text-white`}>
                Payment: {job.payment_status}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span>{job.scheduled_date} at {job.scheduled_start}</span>
        </div>

        {job.customer && (
          <div className="space-y-2">
            {job.customer.name && (
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span>{job.customer.name}</span>
              </div>
            )}
            {job.customer.phone && (
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span>{job.customer.phone}</span>
              </div>
            )}
            {job.customer.email && (
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>{job.customer.email}</span>
              </div>
            )}
          </div>
        )}

        {job.location_notes && (
          <div className="flex items-start space-x-2">
            <MapPin className="h-4 w-4 text-gray-500 mt-1" />
            <span className="text-sm">{job.location_notes}</span>
          </div>
        )}

        {job.service?.base_price && (
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-gray-500" />
            <span>${job.service.base_price}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-4">
          <PaymentCaptureButton
            bookingId={job.id}
            paymentStatus={job.payment_status || 'pending'}
            onCaptureSuccess={onStatusUpdate}
          />
          
          <Button variant="outline" size="sm">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
