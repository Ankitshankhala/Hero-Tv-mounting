import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatBookingTimeForContext, DEFAULT_SERVICE_TIMEZONE } from '@/utils/timeUtils';

interface BookingDetailsModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
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

export const BookingDetailsModal = ({ booking, isOpen, onClose }: BookingDetailsModalProps) => {
  if (!booking) return null;

  const customerName = booking.guest_customer_info?.name || booking.customer?.name || 'Guest Customer';
  const customerEmail = booking.guest_customer_info?.email || booking.customer?.email || 'No email provided';
  const customerPhone = booking.guest_customer_info?.phone || booking.customer?.phone || 'No phone provided';
  
  const formattedDateTime = formatBookingTimeForContext(
    booking, 
    'admin', 
    DEFAULT_SERVICE_TIMEZONE
  );

  const formatServices = () => {
    if (booking.booking_services && booking.booking_services.length > 0) {
      return booking.booking_services.map((service: any) => ({
        service_name: service.service_name,
        quantity: Number(service.quantity) || 1,
        base_price: service.base_price || 0
      }));
    }
    
    const mainServiceName = booking.service?.name || 'TV Mounting';
    const mainServicePrice = booking.service?.base_price || 0;
    
    return [{ service_name: mainServiceName, quantity: 1, base_price: mainServicePrice }];
  };

  const services = formatServices();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Booking Details #{booking.id.slice(0, 8)}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status and Payment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Status</h3>
              <Badge variant={getStatusVariant(booking.status)}>
                {booking.status}
              </Badge>
            </div>
            <div>
              <h3 className="font-medium mb-2">Payment Status</h3>
              <Badge variant={getPaymentStatusVariant(booking.payment_status)}>
                {booking.payment_status || 'unknown'}
              </Badge>
            </div>
          </div>

          {/* Customer Information */}
          <div>
            <h3 className="font-medium mb-3">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Name:</span>
                <p className="mt-1">{customerName}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Email:</span>
                <p className="mt-1">{customerEmail}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Phone:</span>
                <p className="mt-1">{customerPhone}</p>
              </div>
              {booking.guest_customer_info?.address && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Address:</span>
                  <p className="mt-1">{booking.guest_customer_info.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Service Information */}
          <div>
            <h3 className="font-medium mb-3">Service Details</h3>
            <div className="space-y-3">
              {services.map((service, index) => (
                <div key={index} className="bg-muted/30 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{service.service_name}</h4>
                      {service.quantity > 1 && (
                        <p className="text-sm text-muted-foreground">Quantity: {service.quantity}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(service.base_price * service.quantity).toFixed(2)}</p>
                      {service.quantity > 1 && (
                        <p className="text-sm text-muted-foreground">${service.base_price} each</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduling Information */}
          <div>
            <h3 className="font-medium mb-3">Scheduling</h3>
            <div className="bg-muted/30 p-4 rounded-lg space-y-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Scheduled Date & Time:</span>
                <p className="mt-1 font-medium">{formattedDateTime}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Created:</span>
                <p className="mt-1">{format(new Date(booking.created_at), 'MMM dd, yyyy at h:mm a')}</p>
              </div>
            </div>
          </div>

          {/* Worker Information */}
          <div>
            <h3 className="font-medium mb-3">Worker Assignment</h3>
            <div className="bg-muted/30 p-4 rounded-lg">
              {booking.worker ? (
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Worker:</span>
                    <p className="mt-1 font-medium">{booking.worker.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Email:</span>
                    <p className="mt-1">{booking.worker.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No worker assigned</p>
              )}
            </div>
          </div>

          {/* Location Notes */}
          {booking.location_notes && (
            <div>
              <h3 className="font-medium mb-3">Location & Instructions</h3>
              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="whitespace-pre-wrap">{booking.location_notes}</p>
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div>
            <h3 className="font-medium mb-3">Payment Information</h3>
            <div className="bg-muted/30 p-4 rounded-lg space-y-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Total Amount:</span>
                <p className="mt-1 font-medium">
                  ${Number(booking.stripe_authorized_amount || booking.total_price || 0).toFixed(2)}
                </p>
              </div>
              {booking.payment_intent_id && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Payment Intent ID:</span>
                  <p className="mt-1 font-mono text-sm">{booking.payment_intent_id}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};