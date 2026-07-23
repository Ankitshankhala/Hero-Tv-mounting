import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BookingRetryAssignment } from './BookingRetryAssignment';

interface EditBookingModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onBookingUpdated: () => void;
}

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface WorkerOption {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  covers_zip?: boolean;
}

export const EditBookingModal = ({ booking, isOpen, onClose, onBookingUpdated }: EditBookingModalProps) => {
  const [formData, setFormData] = useState({
    status: '' as BookingStatus,
    scheduled_date: '',
    scheduled_start: '',
    location_notes: '',
    customer_name: '',
    customer_email: '',
    customer_phone: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Reassign worker state
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [currentWorker, setCurrentWorker] = useState<WorkerOption | null>(null);
  const [isChangingWorker, setIsChangingWorker] = useState(false);
  const [newWorkerId, setNewWorkerId] = useState<string>('');
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // Helper function to validate booking status
  const validateBookingStatus = (status: string): BookingStatus => {
    const validStatuses: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];
    return validStatuses.includes(status as BookingStatus) ? status as BookingStatus : 'pending';
  };

  // Initialize form data when booking changes
  useEffect(() => {
    if (booking && isOpen) {
      setFormData({
        status: validateBookingStatus(booking.status || 'pending'),
        scheduled_date: booking.scheduled_date || '',
        scheduled_start: booking.scheduled_start || '',
        location_notes: booking.location_notes || '',
        customer_name: booking.guest_customer_info?.name || booking.customer?.name || '',
        customer_email: booking.guest_customer_info?.email || booking.customer?.email || '',
        customer_phone: booking.guest_customer_info?.phone || booking.customer?.phone || ''
      });
      setIsChangingWorker(false);
      setNewWorkerId('');
      setReassignError(null);
    }
  }, [booking, isOpen]);

  // Load worker candidates via the any-zip RPC (in-area first, out-of-area allowed)
  useEffect(() => {
    if (!isOpen || !booking) return;
    let cancelled = false;
    (async () => {
      const zip = booking.guest_customer_info?.zipcode || booking.customer?.zip_code;
      const date = formData.scheduled_date || booking.scheduled_date;
      const time = formData.scheduled_start || booking.scheduled_start;

      let list: WorkerOption[] = [];
      if (zip && date && time) {
        const { data, error } = await supabase.rpc('find_available_workers_any_zip', {
          p_zipcode: zip,
          p_date: date,
          p_time: time,
          p_duration_minutes: 60,
        });
        if (!error && data) {
          // Preserve RPC order (in-area first).
          list = (data as any[]).map((w) => ({
            id: w.worker_id,
            name: w.worker_name || null,
            email: w.worker_email || '',
            phone: w.worker_phone || null,
            city: null,
            covers_zip: !!w.covers_zip,
          }));
        } else if (error) {
          console.error('any-zip worker lookup failed', error);
        }
      }

      // Fallback: no zip/slot info — show all active workers so the picker isn't empty.
      if (list.length === 0) {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, phone, city')
          .eq('role', 'worker')
          .eq('is_active', true)
          .order('name');
        if (error) {
          console.error('Failed to load workers', error);
          return;
        }
        list = (data || []) as WorkerOption[];
      }

      if (cancelled) return;
      setWorkers(list);
      if (booking.worker_id) {
        const w = list.find(x => x.id === booking.worker_id);
        setCurrentWorker(w || null);
      } else {
        setCurrentWorker(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, booking, formData.scheduled_date, formData.scheduled_start]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setReassignError(null);

    try {
      const updatedGuestInfo = {
        ...(booking.guest_customer_info || {}),
        name: formData.customer_name,
        email: formData.customer_email,
        phone: formData.customer_phone
      };

      const isReassigning = isChangingWorker && newWorkerId && newWorkerId !== booking.worker_id;
      const previousWorkerId = booking.worker_id as string | null;

      // If reassigning, validate worker availability first against the (possibly updated) slot
      if (isReassigning) {
        // Confirm out-of-area assignments before validating
        const chosen = workers.find(w => w.id === newWorkerId);
        if (chosen && chosen.covers_zip === false) {
          const zip = booking.guest_customer_info?.zipcode || booking.customer?.zip_code || 'this area';
          const ok = window.confirm(
            `Assign outside service area?\n\nThis worker doesn't normally cover ZIP ${zip}. They may have to travel further. Assign anyway?`
          );
          if (!ok) { setLoading(false); return; }
        }
        setValidating(true);
        const { data: validationResult, error: validationError } = await supabase.rpc(
          'validate_worker_booking_assignment',
          {
            p_worker_id: newWorkerId,
            p_booking_date: formData.scheduled_date,
            p_booking_time: formData.scheduled_start,
            p_duration_minutes: 60,
          }
        );
        setValidating(false);
        if (validationError) {
          throw new Error(`Validation failed: ${validationError.message}`);
        }
        const v = validationResult?.[0];
        if (v && v.is_valid === false) {
          setReassignError(v.error_message || 'Selected worker is not available at this time.');
          setLoading(false);
          return;
        }
      }

      const updatePayload: Record<string, any> = {
        status: formData.status,
        scheduled_date: formData.scheduled_date,
        scheduled_start: formData.scheduled_start,
        location_notes: formData.location_notes,
        guest_customer_info: updatedGuestInfo,
      };
      if (isReassigning) {
        updatePayload.worker_id = newWorkerId;
        if (formData.status === 'pending') updatePayload.status = 'confirmed';
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      if (isReassigning) {
        // Notify new worker
        try {
          const newWorker = workers.find(w => w.id === newWorkerId);
          if (newWorker?.email) {
            await supabase.functions.invoke('unified-email-dispatcher', {
              body: {
                bookingId: booking.id,
                recipientEmail: newWorker.email,
                emailType: 'worker_assignment',
              },
            });
          }
        } catch (err) {
          console.error('Failed to notify new worker', err);
        }

        // Notify customer
        try {
          const customerEmail = formData.customer_email
            || booking.customer?.email
            || booking.guest_customer_info?.email;
          if (customerEmail) {
            await supabase.functions.invoke('unified-email-dispatcher', {
              body: {
                bookingId: booking.id,
                recipientEmail: customerEmail,
                emailType: 'customer_booking_confirmation',
              },
            });
          }
        } catch (err) {
          console.error('Failed to notify customer', err);
        }

        toast({
          title: 'Worker reassigned',
          description: 'Booking updated and notifications sent.',
        });
      } else {
        toast({ title: 'Success', description: 'Booking updated successfully' });
      }

      void previousWorkerId;
      onBookingUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error updating booking:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!booking) return null;

  const bookingServices: Array<{ service_name: string; quantity: number; base_price: number }> =
    (booking.booking_services && booking.booking_services.length > 0)
      ? booking.booking_services.map((s: any) => ({
          service_name: s.service_name || 'Service',
          quantity: Number(s.quantity) || 1,
          base_price: Number(s.base_price) || 0,
        }))
      : (booking.service?.name
          ? [{ service_name: booking.service.name, quantity: 1, base_price: Number(booking.service.base_price) || 0 }]
          : []);
  const servicesTotal = bookingServices.reduce((sum, s) => sum + s.quantity * s.base_price, 0);

  const handleStatusChange = (value: string) => {
    if (value === 'cancelled') {
      toast({
        title: 'Use the Cancel action',
        description: 'To cancel, use the booking\'s Cancel action so the payment authorization is voided.',
        variant: 'destructive',
      });
      return;
    }
    handleInputChange('status', value as BookingStatus);
  };

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
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Duration:</span> {selectedService.duration_minutes} minutes
                </div>
                <div className="text-sm text-muted-foreground">
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
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-sm">Assigned Worker</h4>
                  {currentWorker ? (
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{currentWorker.name || 'Unnamed worker'}</div>
                      <div className="truncate">{currentWorker.email}</div>
                      {currentWorker.phone && <div>{currentWorker.phone}</div>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground truncate">Worker ID: {booking.worker_id}</p>
                  )}
                </div>
                {!isChangingWorker && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsChangingWorker(true);
                      setNewWorkerId('');
                      setReassignError(null);
                    }}
                  >
                    Reassign / Reschedule
                  </Button>
                )}
              </div>

              {isChangingWorker && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <Label htmlFor="new_worker">New Worker</Label>
                    <Select value={newWorkerId} onValueChange={(v) => { setNewWorkerId(v); setReassignError(null); }}>
                      <SelectTrigger id="new_worker">
                        <SelectValue placeholder="Select a worker..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workers
                          .filter(w => w.id !== booking.worker_id)
                          .map(w => (
                            <SelectItem key={w.id} value={w.id}>
                              <span className="flex items-center gap-2">
                                <span>{w.name || w.email}{w.city ? ` — ${w.city}` : ''}</span>
                                {w.covers_zip === false ? (
                                  <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-700 border border-amber-500/40">
                                    Outside area
                                  </span>
                                ) : w.covers_zip === true ? (
                                  <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                                    In area
                                  </span>
                                ) : null}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Availability is validated against the scheduled date and time above.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="reassign_reason">Reason (optional)</Label>
                    <Textarea
                      id="reassign_reason"
                      rows={2}
                      value={reassignReason}
                      onChange={(e) => setReassignReason(e.target.value)}
                      placeholder="e.g. Original worker unavailable"
                    />
                  </div>
                  {reassignError && (
                    <p className="text-sm text-destructive">{reassignError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsChangingWorker(false);
                        setNewWorkerId('');
                        setReassignError(null);
                      }}
                    >
                      Cancel reassignment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || validating}>
              {loading ? (isChangingWorker && newWorkerId ? 'Reassigning...' : 'Updating...') : (isChangingWorker && newWorkerId ? 'Save & Reassign' : 'Update Booking')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
