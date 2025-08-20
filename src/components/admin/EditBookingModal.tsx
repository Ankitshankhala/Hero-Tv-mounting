import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';
import { BookingRetryAssignment } from './BookingRetryAssignment';

interface EditBookingModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onBookingUpdated: () => void;
}

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export const EditBookingModal = ({ booking, isOpen, onClose, onBookingUpdated }: EditBookingModalProps) => {
  const [formData, setFormData] = useState({
    status: '' as BookingStatus,
    scheduled_date: '',
    scheduled_start: '',
    service_id: '',
    location_notes: '',
    customer_name: '',
    customer_email: '',
    customer_phone: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { services } = usePublicServicesData();

  // Helper function to validate booking status
  const validateBookingStatus = (status: string): BookingStatus => {
    const validStatuses: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];
    return validStatuses.includes(status as BookingStatus) ? status as BookingStatus : 'pending';
  };

  // Initialize form data when booking changes
  useEffect(() => {
    if (booking && isOpen) {
      console.log('Initializing form with booking:', booking);
      
      setFormData({
        status: validateBookingStatus(booking.status || 'pending'),
        scheduled_date: booking.scheduled_date || '',
        scheduled_start: booking.scheduled_start || '',
        service_id: booking.service_id || booking.service?.id || '',
        location_notes: booking.location_notes || '',
        customer_name: booking.guest_customer_info?.name || booking.customer?.name || '',
        customer_email: booking.guest_customer_info?.email || booking.customer?.email || '',
        customer_phone: booking.guest_customer_info?.phone || booking.customer?.phone || ''
      });
    }
  }, [booking, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Updating booking with data:', formData);

      // Update guest customer information in booking
      const updatedGuestInfo = {
        ...(booking.guest_customer_info || {}),
        name: formData.customer_name,
        email: formData.customer_email,
        phone: formData.customer_phone
      };

      // Update booking information (including guest customer info)
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: formData.status,
          scheduled_date: formData.scheduled_date,
          scheduled_start: formData.scheduled_start,
          service_id: formData.service_id,
          location_notes: formData.location_notes,
          guest_customer_info: updatedGuestInfo
        })
        .eq('id', booking.id);

      if (bookingError) {
        console.error('Error updating booking:', bookingError);
        throw bookingError;
      }

      toast({
        title: "Success",
        description: "Booking updated successfully",
      });

      onBookingUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: "Failed to update booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!booking) return null;

  const selectedService = services.find(s => s.id === formData.service_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Booking #{booking.id.slice(0, 8)}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleInputChange('customer_name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="customer_email">Customer Email</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => handleInputChange('customer_email', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="customer_phone">Customer Phone</Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => handleInputChange('customer_phone', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={(value) => handleInputChange('status', value as BookingStatus)} value={formData.status}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Service and Scheduling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="service_id">Service</Label>
              <Select onValueChange={(value) => handleInputChange('service_id', value)} value={formData.service_id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - ${service.base_price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="scheduled_date">Scheduled Date</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="scheduled_start">Scheduled Time</Label>
              <Input
                id="scheduled_start"
                type="time"
                value={formData.scheduled_start}
                onChange={(e) => handleInputChange('scheduled_start', e.target.value)}
                required
              />
            </div>
            {selectedService && (
              <div className="flex flex-col justify-end">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Duration:</span> {selectedService.duration_minutes} minutes
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Price:</span> ${selectedService.base_price}
                </div>
              </div>
            )}
          </div>

          {/* Location Notes */}
          <div>
            <Label htmlFor="location_notes">Location & Instructions</Label>
            <Textarea
              id="location_notes"
              value={formData.location_notes || ''}
              onChange={(e) => handleInputChange('location_notes', e.target.value)}
              rows={4}
              placeholder="Service address and special instructions..."
            />
          </div>

          {/* Worker Assignment Section */}
          {!booking.worker_id && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Worker Assignment</h4>
                  <p className="text-sm text-muted-foreground">
                    No worker assigned. Try automatic assignment or assign manually.
                  </p>
                </div>
                <BookingRetryAssignment 
                  bookingId={booking.id} 
                  onRetryComplete={onBookingUpdated}
                />
              </div>
            </div>
          )}

          {booking.worker_id && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="text-green-600 font-medium text-sm">
                  ✓ Worker Assigned
                </div>
                <span className="text-sm text-muted-foreground">
                  Worker ID: {booking.worker_id}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Booking'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
