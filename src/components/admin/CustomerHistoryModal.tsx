
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, DollarSign, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CustomerHistoryModalProps {
  customer: any;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerHistoryModal = ({ customer, isOpen, onClose }: CustomerHistoryModalProps) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && customer) {
      fetchCustomerBookings();
    }
  }, [isOpen, customer]);

  const fetchCustomerBookings = async () => {
    try {
      // Fetch bookings for guest customer by email
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          worker:users!worker_id(name),
          booking_services (
            service_name,
            base_price,
            quantity
          )
        `)
        .not('guest_customer_info', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter bookings for this specific customer email
      const customerBookings = data?.filter(booking => {
        const guestInfo = booking.guest_customer_info as any;
        return guestInfo?.email === customer.email;
      }) || [];

      setBookings(customerBookings);
    } catch (error) {
      console.error('Error fetching customer bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load customer history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatServices = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => s.name).join(', ');
    }
    return 'Service';
  };

  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Booking History - {customer.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{customer.totalBookings}</div>
                <div className="text-sm text-gray-600">Total Bookings</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{customer.totalSpent}</div>
                <div className="text-sm text-gray-600">Total Spent</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{customer.lastBooking}</div>
                <div className="text-sm text-gray-600">Last Booking</div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading booking history...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No bookings found for this customer</p>
            </div>
          ) : (
                  <div className="space-y-4">
                <h3 className="text-lg font-semibold">Booking History</h3>
                {bookings.map((booking: any) => {
                  const totalPrice = booking.booking_services?.reduce((sum: number, service: any) => 
                    sum + (Number(service.base_price) * service.quantity), 0
                  ) || 0;
                  
                  return (
                    <Card key={booking.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">Booking #{booking.id.slice(0, 8)}</h4>
                            <p className="text-sm text-gray-600">
                              {booking.booking_services?.map((s: any) => s.service_name).join(', ') || 'Services'}
                            </p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(booking.status)}
                            <p className="text-lg font-bold mt-1">${totalPrice.toFixed(2)}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(booking.scheduled_date).toLocaleDateString()} at{' '}
                              {booking.scheduled_start}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>{booking.worker?.name || 'Unassigned'}</span>
                          </div>
                          <div className="flex items-center space-x-2 col-span-2">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate">
                              {booking.guest_customer_info?.city}, {booking.guest_customer_info?.zipcode}
                            </span>
                          </div>
                        </div>

                        {booking.location_notes && (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                            <strong>Location Notes:</strong> {booking.location_notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
