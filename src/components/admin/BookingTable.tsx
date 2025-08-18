import React, { useState } from 'react';
import { format } from 'date-fns';
import { Edit, Trash2, Eye, UserPlus, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBookingTimeForContext, US_TIMEZONES, DEFAULT_SERVICE_TIMEZONE } from '@/utils/timezoneUtils';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Worker {
  id: string;
  name: string;
  email: string;
}

interface Service {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  customer_id: string;
  worker_id: string | null;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  status: string;
  created_at: string;
  customer?: Customer;
  worker?: Worker;
  service?: Service;
  payment_intent_id?: string;
  payment_status?: string;
  total_price?: number;
  stripe_authorized_amount?: number;
  stripe_payment_status?: string;
  services?: any[];
  booking_services?: any[];
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'confirmed':
      return 'default';
    case 'completed':
      return 'outline';
    case 'cancelled':
      return 'destructive';
    default:
      return 'default';
  }
};

const getPaymentStatusVariant = (status: string | undefined) => {
  switch (status) {
    case 'pending':
      return 'secondary';
    case 'authorized':
      return 'secondary';
    case 'succeeded':
      return 'outline';
    case 'completed':
      return 'outline';
    case 'failed':
      return 'destructive';
    default:
      return 'default';
  }
};

const getCustomerName = (booking: Booking) => {
  return booking.customer?.name || 'Guest Customer';
};

const getCustomerEmail = (booking: Booking) => {
  return booking.customer?.email || 'No email provided';
};

const getCustomerPhone = (booking: Booking) => {
  return booking.customer?.phone || 'No phone provided';
};

interface BookingTableProps {
  bookings: Booking[];
  onEditBooking: (booking: Booking) => void;
  onDeleteBooking: (booking: Booking) => void;
  onViewBooking: (booking: Booking) => void;
  onAssignWorker: (booking: Booking) => void;
  onViewCalendar?: (workerId: string) => void;
  onBookingUpdate?: () => void;
  loading?: boolean;
}

export const BookingTable = ({ 
  bookings, 
  onEditBooking, 
  onDeleteBooking, 
  onViewBooking, 
  onAssignWorker,
  onViewCalendar,
  onBookingUpdate,
  loading = false 
}: BookingTableProps) => {
  const [displayTimezone, setDisplayTimezone] = useState(DEFAULT_SERVICE_TIMEZONE);

  const formatServices = (booking: Booking) => {
    // If we have booking_services data, use that directly
    if (booking.booking_services && booking.booking_services.length > 0) {
      return booking.booking_services.map(service => ({
        service_name: service.service_name,
        quantity: Number(service.quantity) || 1
      }));
    }
    
    // Fallback to main service if no booking_services
    const mainServiceName = booking.service?.name || 
      (Array.isArray(booking.services) && booking.services[0]?.name) || 
      'TV Mounting';
    
    return [{ service_name: mainServiceName, quantity: 1 }];
  };

  const renderServiceLines = (services: any[]) => {
    return services.map((service, index) => (
      <div key={index} className="text-sm">
        {service.quantity > 1 && (
          <span className="text-muted-foreground">{service.quantity}x </span>
        )}
        {service.service_name}
      </div>
    ));
  };

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {loading ? 'Loading bookings...' : 'No bookings found'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timezone Selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium">Display timezone:</span>
        <Select value={displayTimezone} onValueChange={setDisplayTimezone}>
          <SelectTrigger className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {US_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Booking ID</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Services</th>
                <th className="text-left p-3 font-medium">Worker</th>
                <th className="text-left p-3 font-medium">Date & Time</th>
                <th className="text-left p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Payment</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const services = formatServices(booking);
                const formattedDateTime = formatBookingTimeForContext(
                  booking, 
                  'admin', 
                  displayTimezone
                );
                
                return (
                  <tr key={booking.id} className="border-b hover:bg-muted/25">
                    <td className="p-3">
                      <div className="font-mono text-sm">
                        {booking.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {getCustomerName(booking)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getCustomerEmail(booking)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getCustomerPhone(booking)}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {renderServiceLines(services)}
                      </div>
                    </td>
                    <td className="p-3">
                      {booking.worker ? (
                        <div className="space-y-1">
                          <div className="font-medium">{booking.worker.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {booking.worker.email}
                          </div>
                          {onViewCalendar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewCalendar(booking.worker.id)}
                              className="h-6 px-2 text-xs"
                            >
                              <Calendar className="h-3 w-3 mr-1" />
                              Calendar
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAssignWorker(booking)}
                          className="h-8"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="font-medium">{formattedDateTime}</div>
                        <div className="text-xs text-muted-foreground">
                          Created: {format(new Date(booking.created_at), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">
                        ${Number(booking.stripe_authorized_amount || booking.total_price || 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={getStatusVariant(booking.status)}>
                        {booking.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <Badge variant={getPaymentStatusVariant(booking.payment_status || booking.stripe_payment_status)}>
                          {booking.payment_status || booking.stripe_payment_status || 'unknown'}
                        </Badge>
                        {booking.payment_intent_id && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {booking.payment_intent_id.slice(-8)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewBooking(booking)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditBooking(booking)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteBooking(booking)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
