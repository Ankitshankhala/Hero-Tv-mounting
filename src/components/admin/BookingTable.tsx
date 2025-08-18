import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Edit, Trash2, DollarSign, UserPlus, CheckCircle, Mail } from 'lucide-react';
import { EditBookingModal } from './EditBookingModal';
import { DeleteBookingModal } from './DeleteBookingModal';
import { ManualChargeModal } from '@/components/worker/payment/ManualChargeModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSmsNotifications } from '@/hooks/useSmsNotifications';
import { useNotificationFailures } from '@/hooks/useNotificationFailures';
interface Booking {
  id: string;
  customer?: {
    name?: string;
    city?: string;
  };
  service?: {
    name?: string;
    duration_minutes?: number;
  };
  services?: any[];
  scheduled_date?: string;
  scheduled_start?: string;
  scheduled_at?: string;
  worker?: {
    name?: string;
  };
  status: string;
  payment_status?: string;
  total_price?: number;
  customer_address?: string;
  location_notes?: string;
  cancellation_deadline?: string;
  late_fee_charged?: boolean;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
}
interface BookingTableProps {
  bookings: Booking[];
  onBookingUpdate?: () => void;
}
export const BookingTable = React.memo(({
  bookings,
  onBookingUpdate
}: BookingTableProps) => {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showManualChargeModal, setShowManualChargeModal] = useState(false);
  const [showAssignWorkerModal, setShowAssignWorkerModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkResending, setIsBulkResending] = useState(false);
  const { toast } = useToast();
  const { resendWorkerEmail, resendCustomerEmail, resendWorkerSms } = useSmsNotifications();
  const { failureMap, refetch: refetchNotificationStatuses } = useNotificationFailures(bookings.map(b => b.id));
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: 'Pending',
        variant: 'secondary' as const
      },
      payment_pending: {
        label: 'Awaiting Payment',
        variant: 'secondary' as const
      },
      confirmed: {
        label: 'Confirmed',
        variant: 'default' as const
      },
      'in_progress': {
        label: 'In Progress',
        variant: 'secondary' as const
      },
      completed: {
        label: 'Completed',
        variant: 'outline' as const
      },
      cancelled: {
        label: 'Cancelled',
        variant: 'destructive' as const
      }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  const getPaymentStatusBadge = (paymentStatus?: string, booking?: Booking) => {
    if (!paymentStatus) return null;
    
    const statusConfig = {
      pending: {
        label: 'Payment Pending',
        variant: 'secondary' as const,
        className: 'bg-yellow-100 text-yellow-800'
      },
      authorized: {
        label: 'Payment Authorized',
        variant: 'default' as const,
        className: 'bg-blue-100 text-blue-800'
      },
      captured: {
        label: 'Payment Captured',
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800'
      },
      completed: {
        label: 'Payment Completed',
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800'
      },
      failed: {
        label: 'Payment Failed',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800'
      },
      cancelled: {
        label: 'Payment Cancelled',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800'
      }
    };
    
    const config = statusConfig[paymentStatus as keyof typeof statusConfig];
    if (!config) return null;
    
    return (
      <div className="flex flex-col space-y-1">
        <Badge variant={config.variant} className={`ml-2 ${config.className}`}>
          {config.label}
        </Badge>
        {(paymentStatus === 'captured' || paymentStatus === 'completed') && booking?.status === 'completed' && (
          <span className="text-xs text-green-600 ml-2">✓ Service Complete & Paid</span>
        )}
      </div>
    );
  };
  const formatServices = (booking: Booking) => {
    if (booking.service?.name) {
      return booking.service.name;
    }
    if (Array.isArray(booking.services) && booking.services.length > 0) {
      return booking.services.map(s => s.name).join(', ');
    }
    return 'N/A';
  };
  const formatDuration = (booking: Booking) => {
    let totalMinutes = 0;
    if (booking.service?.duration_minutes) {
      totalMinutes = booking.service.duration_minutes;
    } else if (Array.isArray(booking.services) && booking.services.length > 0) {
      totalMinutes = booking.services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    }
    if (totalMinutes === 0) return 'N/A';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  const formatDateTime = (booking: Booking) => {
    let dateTimeString = '';
    if (booking.scheduled_date && booking.scheduled_start) {
      dateTimeString = `${booking.scheduled_date}T${booking.scheduled_start}`;
    } else if (booking.scheduled_at) {
      dateTimeString = booking.scheduled_at;
    }
    if (!dateTimeString) return {
      date: 'N/A',
      time: 'N/A'
    };
    try {
      const date = new Date(dateTimeString);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    } catch (error) {
      return {
        date: 'N/A',
        time: 'N/A'
      };
    }
  };
  const isEligibleForLateFee = (booking: Booking): boolean => {
    if (booking.status !== 'cancelled') return false;
    if (booking.late_fee_charged) return false;
    if (!booking.cancellation_deadline) return false;
    if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) return false;
    try {
      const deadline = new Date(booking.cancellation_deadline);
      const now = new Date();
      return now > deadline;
    } catch (error) {
      return false;
    }
  };
  const isUnassigned = (booking: Booking) => {
    return !booking.worker?.name;
  };
  const canMarkComplete = (booking: Booking) => {
    return booking.status === 'in_progress' && booking.worker?.name;
  };
  const handleEdit = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setShowEditModal(true);
  }, []);
  const handleDelete = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setShowDeleteModal(true);
  }, []);
  const handleLateFeeCharge = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setShowManualChargeModal(true);
  }, []);
  const handleAssignWorker = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setShowAssignWorkerModal(true);
  }, []);
  const handleMarkComplete = useCallback(async (booking: Booking) => {
    if (booking.status === 'completed') return;
    setIsUpdating(booking.id);
    try {
      const {
        error
      } = await supabase.from('bookings').update({
        status: 'completed'
      }).eq('id', booking.id);
      if (error) throw error;
      toast({
        title: "Booking Completed",
        description: "Booking marked as completed. Invoice will be generated automatically."
      });
      if (onBookingUpdate) {
        onBookingUpdate();
      }
    } catch (error) {
      console.error('Error marking booking as complete:', error);
      toast({
        title: "Error",
        description: "Failed to mark booking as completed",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(null);
    }
  }, [onBookingUpdate, toast]);

  const handleResendNotifications = useCallback(async (booking: Booking) => {
    setIsResending(booking.id);
    try {
      // Fire all relevant notifications concurrently
      const results = await Promise.allSettled([
        resendWorkerEmail(booking.id),
        resendCustomerEmail(booking.id),
        resendWorkerSms(booking.id),
      ]);
      // Basic summary toast; individual hooks also show detailed toasts
      const anySuccess = results.some(r => r.status === 'fulfilled' && r.value === true);
      toast({
        title: anySuccess ? "Notifications re-sent" : "Notifications failed",
        description: anySuccess ? "Worker and customer notifications have been re-triggered." : "Could not resend notifications. Check logs.",
        variant: anySuccess ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error resending notifications:', error);
      toast({
        title: "Error",
        description: "Failed to resend notifications",
        variant: "destructive",
      });
    } finally {
      setIsResending(null);
      refetchNotificationStatuses();
    }
  }, [resendWorkerEmail, resendCustomerEmail, resendWorkerSms, toast, refetchNotificationStatuses]);

  // Selection helpers
  const failedIds = useMemo(() => Object.keys(failureMap || {}), [failureMap]);
  const allSelected = useMemo(
    () => bookings.length > 0 && bookings.every(b => selectedIds.has(b.id)),
    [bookings, selectedIds]
  );

  const toggleSelect = useCallback((id: string, checked: boolean | "indeterminate") => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedIds(new Set(bookings.map(b => b.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [bookings]);

  const selectAllFailed = useCallback(() => {
    setSelectedIds(new Set(failedIds));
  }, [failedIds]);

  const handleBulkResend = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkResending(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          await Promise.allSettled([
            resendWorkerEmail(id),
            resendCustomerEmail(id),
            resendWorkerSms(id),
          ]);
          return true;
        })
      );
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      toast({
        title: 'Bulk resend complete',
        description: `Processed ${ids.length} booking(s). Success: ${successCount}`,
      });
    } catch (e) {
      console.error('Bulk resend failed', e);
      toast({ title: 'Bulk resend failed', variant: 'destructive' });
    } finally {
      setIsBulkResending(false);
      refetchNotificationStatuses();
    }
  }, [selectedIds, resendWorkerEmail, resendCustomerEmail, resendWorkerSms, toast, refetchNotificationStatuses]);

  const handleModalClose = useCallback(() => {
    setSelectedBooking(null);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowManualChargeModal(false);
    setShowAssignWorkerModal(false);
  }, []);
  const handleBookingUpdated = useCallback(() => {
    if (onBookingUpdate) {
      onBookingUpdate();
    }
    handleModalClose();
  }, [onBookingUpdate, handleModalClose]);

  // Memoize expensive calculations
  const processedBookings = useMemo(() => {
    return bookings.map(booking => ({
      ...booking,
      formattedDateTime: formatDateTime(booking),
      canChargeFee: isEligibleForLateFee(booking),
      needsWorkerAssignment: isUnassigned(booking),
      formattedServices: formatServices(booking),
      formattedDuration: formatDuration(booking)
    }));
  }, [bookings]);
  return <>
      <div className="rounded-md border">
        {failedIds.length > 0 && (
          <Alert className="m-3">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>{failedIds.length} booking(s) have failed notifications.</span>
              <Button variant="outline" size="sm" onClick={selectAllFailed}>
                Select all failed
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b">
          <div className="text-sm">{selectedIds.size} selected</div>
          <Button size="sm" onClick={handleBulkResend} disabled={selectedIds.size === 0 || isBulkResending}>
            Retry failed notifications
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1200px]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Booking ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedBookings.map(booking => {
            const {
              date,
              time
            } = booking.formattedDateTime;
            const canChargeFee = booking.canChargeFee;
            const needsWorkerAssignment = booking.needsWorkerAssignment;
            return <TableRow key={booking.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(booking.id)}
                      onCheckedChange={(checked) => toggleSelect(booking.id, checked)}
                      aria-label="Select booking"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{booking.id.slice(0, 8)}</TableCell>
                  <TableCell>{booking.customer?.name || 'N/A'}</TableCell>
                  <TableCell>{booking.formattedServices}</TableCell>
                  <TableCell>
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {booking.formattedDuration}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{date}</div>
                      <div className="text-sm text-gray-600">{time}</div>
                    </div>
                  </TableCell>
                  <TableCell>{booking.customer?.city || booking.customer_address || booking.location_notes || 'N/A'}</TableCell>
                  <TableCell>
                    {needsWorkerAssignment ? <Badge variant="secondary" className="text-orange-600">
                        Unassigned
                      </Badge> : booking.worker?.name || 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(booking.status)}
                    {failureMap[booking.id] && (
                      <Badge variant="destructive" className="ml-2">Notif failed</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getPaymentStatusBadge(booking.payment_status, booking)}</TableCell>
                  <TableCell className="font-medium">${booking.total_price || 0}</TableCell>
                   <TableCell className="min-w-[200px]">
                     <div className="flex flex-wrap gap-1">
                       {needsWorkerAssignment && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleAssignWorker(booking)}
                           className="text-green-600 hover:text-green-700"
                           title="Assign Worker"
                         >
                           <UserPlus className="h-4 w-4" />
                         </Button>
                       )}

                       {canMarkComplete(booking) && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleMarkComplete(booking)}
                           disabled={isUpdating === booking.id}
                           className="text-green-600 hover:text-green-700"
                           title="Mark as Completed"
                         >
                           <CheckCircle className="h-4 w-4" />
                         </Button>
                       )}

                       {!needsWorkerAssignment && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleResendNotifications(booking)}
                           disabled={isResending === booking.id}
                           title="Resend Notifications"
                         >
                           <Mail className="h-4 w-4" />
                         </Button>
                       )}

                       <Button variant="outline" size="sm" onClick={() => handleEdit(booking)}>
                         <Edit className="h-4 w-4" />
                       </Button>
                       <Button variant="outline" size="sm" onClick={() => handleDelete(booking)}>
                         <Trash2 className="h-4 w-4" />
                       </Button>
                       {canChargeFee && (
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleLateFeeCharge(booking)}
                           className="text-orange-600 hover:text-orange-700"
                           title="Charge Late Fee"
                         >
                           <DollarSign className="h-4 w-4" />
                         </Button>
                       )}
                     </div>
                   </TableCell>
                </TableRow>;
          })}
          </TableBody>
          </Table>
        </div>
        
        {bookings.length === 0 && <div className="text-center py-8 text-gray-500">
            No bookings found matching your criteria
          </div>}
      </div>

      {/* Edit Modal */}
      <EditBookingModal booking={selectedBooking} isOpen={showEditModal} onClose={handleModalClose} onBookingUpdated={handleBookingUpdated} />

      {/* Delete Modal */}
      <DeleteBookingModal booking={selectedBooking} isOpen={showDeleteModal} onClose={handleModalClose} onBookingDeleted={handleBookingUpdated} />

      {/* Manual Charge Modal */}
      <ManualChargeModal booking={selectedBooking} isOpen={showManualChargeModal} onClose={handleModalClose} onChargeComplete={handleBookingUpdated} />

      {/* Assign Worker Modal */}
      <AssignWorkerModal onClose={handleModalClose} onAssignmentComplete={handleBookingUpdated} isOpen={showAssignWorkerModal} selectedBookingId={selectedBooking?.id} />
    </>;
});