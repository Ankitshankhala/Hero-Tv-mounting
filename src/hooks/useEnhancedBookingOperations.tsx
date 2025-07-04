
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSmsNotifications } from './useSmsNotifications';

export const useEnhancedBookingOperations = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { sendWorkerAssignmentSms } = useSmsNotifications();

  const createBookingWithCoverage = async (bookingData: any) => {
    setLoading(true);
    try {
      console.log('Creating booking with coverage system:', bookingData);

      // Create the booking first
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: bookingData.customer_id,
          service_id: bookingData.service_id,
          scheduled_date: bookingData.scheduled_date,
          scheduled_start: bookingData.scheduled_start,
          location_notes: bookingData.location_notes,
          status: 'pending'
        })
        .select()
        .single();

      if (bookingError) {
        throw bookingError;
      }

      console.log('Booking created:', booking);

      // Use the enhanced auto-assignment with coverage notifications
      const { data: assignmentResult, error: assignmentError } = await supabase
        .rpc('auto_assign_workers_with_coverage', {
          p_booking_id: booking.id
        });

      if (assignmentError) {
        console.error('Assignment error:', assignmentError);
        // Don't throw error here - booking is still created
      }

      console.log('Assignment result:', assignmentResult);

      const result = assignmentResult?.[0];
      
      if (result?.assignment_status === 'direct_assigned') {
        // Worker was directly assigned
        toast({
          title: "Booking Confirmed!",
          description: "A worker has been assigned to your booking",
        });
        
        // Send SMS notification to assigned worker
        await sendWorkerAssignmentSms(booking.id);
        
        // Send coverage notifications
        await sendCoverageNotifications(booking.id, false);
        
        return {
          booking_id: booking.id,
          status: 'confirmed',
          message: 'Booking confirmed with worker assigned',
          worker_assigned: true
        };
      } else if (result?.assignment_status === 'coverage_notifications_sent') {
        // Coverage notifications were sent
        toast({
          title: "Booking Created",
          description: `Coverage requests sent to ${result.notifications_sent} workers in your area`,
        });
        
        // Send coverage notifications
        await sendCoverageNotifications(booking.id, false);
        
        return {
          booking_id: booking.id,
          status: 'pending',
          message: `Coverage requests sent to ${result.notifications_sent} workers`,
          notifications_sent: result.notifications_sent
        };
      } else {
        // No workers found even for coverage
        toast({
          title: "Booking Created",
          description: "No workers available in your area. Admin will assign manually.",
          variant: "destructive",
        });
        
        return {
          booking_id: booking.id,
          status: 'pending',
          message: 'No workers available. Manual assignment required.',
          notifications_sent: 0
        };
      }

    } catch (error) {
      console.error('Error creating booking with coverage:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendCoverageNotifications = async (bookingId: string, urgent: boolean = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/functions/v1/notify-workers-coverage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          urgent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send coverage notifications');
      }

      const result = await response.json();
      console.log('Coverage notifications sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending coverage notifications:', error);
    }
  };

  const sendUrgentCoverageRequest = async (bookingId: string) => {
    setLoading(true);
    try {
      const result = await sendCoverageNotifications(bookingId, true);
      
      toast({
        title: "Urgent Coverage Request Sent",
        description: `Urgent notifications sent to available workers`,
      });
      
      return result;
    } catch (error) {
      console.error('Error sending urgent coverage request:', error);
      toast({
        title: "Error",
        description: "Failed to send urgent coverage request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    createBookingWithCoverage,
    sendUrgentCoverageRequest,
    loading
  };
};
