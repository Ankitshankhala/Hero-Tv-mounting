import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { WorkerSidebar } from '@/components/worker/WorkerSidebar';
import WorkerDashboardHeader from '@/components/worker/WorkerDashboardHeader';
import { WorkerJobsTab } from '@/components/worker/WorkerJobsTab';
// TODO: Import these components when they're available
// import WorkerCalendar from '@/components/worker/WorkerCalendar';
// import WorkerScheduleManager from '@/components/worker/WorkerScheduleManager';
// import ServiceAreaSettings from '@/components/settings/ServiceAreaSettings';
import { WorkerEarnings } from '@/components/worker/WorkerEarnings';
import { WorkerWeeklyEarnings } from '@/components/worker/WorkerWeeklyEarnings';
import { WorkerNotificationsCenter } from '@/components/worker/WorkerNotificationsCenter';
import { WorkerProfileSettings } from '@/components/worker/WorkerProfileSettings';
import WorkerDashboardLoading from '@/components/worker/WorkerDashboardLoading';
import WorkerLoginForm from '@/components/worker/WorkerLoginForm';
import CoverageNotifications from '@/components/worker/CoverageNotifications';
import { ImpersonationBanner } from '@/components/worker/ImpersonationBanner';
// TODO: Import CreateBookingModal when available
// import CreateBookingModal from '@/components/worker/CreateBookingModal';
import { TourProvider } from '@/contexts/TourContext';
import { TourManager } from '@/components/tour/TourManager';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { VALID_WORKER_BOOKING_STATUSES, EXCLUDED_PAYMENT_STATUSES } from '@/constants/bookingStatuses';

type BookingStatus = Database['public']['Enums']['booking_status'];

export function WorkerDashboardWithSidebar() {
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [totalTips, setTotalTips] = useState(0);
  const location = useLocation();

  // Set up real-time job updates
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'worker',
    onBookingUpdate: (updatedBooking, reassignmentInfo) => {
      console.log('Real-time booking update received:', updatedBooking, reassignmentInfo);
      setJobs(currentJobs => {
        const existingJobIndex = currentJobs.findIndex(job => job.id === updatedBooking.id);
        
        // Handle job reassignment
        if (reassignmentInfo?.wasReassignedAway) {
          // Remove job that was reassigned away from this worker
          console.log('Job reassigned away, removing from list');
          return currentJobs.filter(job => job.id !== updatedBooking.id);
        }
        
        if (reassignmentInfo?.wasReassignedTo) {
          // Job was reassigned to this worker, refetch to get complete data
          console.log('Job reassigned to this worker, refetching jobs');
          fetchWorkerJobs();
          return currentJobs;
        }
        
        if (existingJobIndex >= 0) {
          // Check if updated booking still has valid status for workers
          if (!VALID_WORKER_BOOKING_STATUSES.includes(updatedBooking.status) ||
              EXCLUDED_PAYMENT_STATUSES.includes(updatedBooking.payment_status)) {
            // Status changed to invalid state - remove from worker's view
            console.log('Job status/payment invalid, removing from list:', updatedBooking.status, updatedBooking.payment_status);
            return currentJobs.filter(job => job.id !== updatedBooking.id);
          }
          
          // Update existing job
          const updatedJobs = [...currentJobs];
          updatedJobs[existingJobIndex] = {
            ...updatedJobs[existingJobIndex],
            ...updatedBooking
          };
          console.log('Updated existing job:', updatedJobs[existingJobIndex]);
          return updatedJobs;
        } else if (updatedBooking.worker_id === user?.id) {
          // Add new job if it's assigned to this worker
          console.log('New job assigned, refetching jobs');
          fetchWorkerJobs();
          return currentJobs;
        }
        return currentJobs;
      });
    }
  });

  useEffect(() => {
    if (user && profile && profile.role === 'worker') {
      fetchWorkerJobs();
      fetchTotalTips();
    }
  }, [user, profile]);

  // Clean up any invalid job statuses that might be in state
  useEffect(() => {
    if (!loading && jobs.length > 0) {
      const filteredJobs = jobs.filter(job => 
        VALID_WORKER_BOOKING_STATUSES.includes(job.status) &&
        !EXCLUDED_PAYMENT_STATUSES.includes(job.payment_status)
      );
      
      if (filteredJobs.length !== jobs.length) {
        console.log('Cleaning up invalid job statuses/payments from state');
        setJobs(filteredJobs);
      }
    }
  }, [jobs, loading]);

  const fetchTotalTips = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_tip_analytics', {
        p_start_date: null,
        p_end_date: null
      });

      if (error) {
        console.error('Error fetching tips analytics:', error);
        return;
      }

      const workerTips = data?.find((w: any) => w.worker_id === user.id);
      setTotalTips(workerTips?.total_tips || 0);
    } catch (error) {
      console.error('Error in fetchTotalTips:', error);
    }
  };

  useEffect(() => {
    // Scroll to active jobs section after loading
    if (!loading && jobs.length > 0) {
      const element = document.getElementById('active-jobs-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [loading, jobs]);

  const fetchWorkerJobs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_services (
            id,
            service_name,
            base_price,
            quantity,
            configuration
          ),
          users!customer_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('worker_id', user.id)
        .in('status', ['confirmed', 'completed', 'payment_authorized'])
        .not('payment_status', 'in', '(pending,payment_pending)')
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      const formattedJobs = bookings?.map(booking => ({
        ...booking,
        address: (booking.guest_customer_info as any)?.address || 'Address not available',
        total_amount: booking.pending_payment_amount || 0
      })) || [];

      setJobs(formattedJobs);
    } catch (error) {
      console.error('Error fetching worker jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: BookingStatus) => {
    try {
      // Update the job status in the database
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      // Handle payment capture for completed jobs
      if (newStatus === 'completed') {
        try {
          const { error: captureError } = await supabase.functions.invoke('capture-payment', {
            body: { bookingId: jobId }
          });

          if (captureError) {
            console.error('Error capturing payment:', captureError);
            toast({
              title: "Payment Capture Failed",
              description: "Job marked as completed, but payment capture failed. Please contact support.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Job Completed Successfully",
              description: "Payment has been captured and the job is now complete.",
            });
          }
        } catch (captureError) {
          console.error('Error in payment capture:', captureError);
          toast({
            title: "Payment Capture Error",
            description: "Job marked as completed, but there was an issue capturing payment.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Job Status Updated",
          description: `Job status has been updated to ${newStatus}.`,
        });
      }

      // Refresh the jobs list
      await fetchWorkerJobs();
    } catch (error) {
      console.error('Error updating job status:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update job status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleJobCancelled = () => {
    fetchWorkerJobs();
  };

  const handleBookingCreated = () => {
    fetchWorkerJobs();
    setShowCreateBooking(false);
    toast({
      title: "Booking Created",
      description: "New booking has been created successfully.",
    });
  };

  // Calculate job stats for sidebar
  const jobStats = {
    activeJobs: jobs.filter(job => 
      !job.is_archived && 
      job.status !== 'completed' &&
      job.status !== 'cancelled' &&
      job.worker_id
    ).length,
    upcomingJobs: jobs.filter(job => 
      !job.is_archived && 
      job.status === 'confirmed' &&
      new Date(job.scheduled_date) > new Date()
    ).length,
    pendingPayments: jobs.filter(job => 
      !job.is_archived && 
      job.payment_status === 'pending'
    ).length
  };

  if (authLoading || (user && !profile)) {
    return <WorkerDashboardLoading />;
  }

  if (!user || !profile || profile.role !== 'worker') {
    return <WorkerLoginForm />;
  }

  return (
    <TourProvider>
      <SidebarProvider>
        <div className="min-h-screen flex flex-col w-full bg-background">
          <ImpersonationBanner />
          
          <div className="flex flex-1 w-full">
            <WorkerSidebar jobStats={jobStats} />
            
            <div className="flex-1 flex flex-col">
              <WorkerDashboardHeader workerName={profile?.name || 'Worker'} />
            
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={
                  <WorkerJobsTab
                    jobs={jobs}
                    onStatusUpdate={updateJobStatus}
                    onJobCancelled={handleJobCancelled}
                  />
                } />
                <Route path="/calendar" element={
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-4">Calendar</h1>
                    <p className="text-muted-foreground">Calendar view coming soon...</p>
                  </div>
                } />
                <Route path="/earnings" element={<WorkerEarnings />} />
                <Route path="/earnings/weekly" element={<WorkerWeeklyEarnings />} />
                <Route path="/notifications" element={<WorkerNotificationsCenter />} />
                <Route path="/schedule" element={
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-4">Schedule Manager</h1>
                    <p className="text-muted-foreground">Schedule management coming soon...</p>
                  </div>
                } />
                <Route path="/service-area" element={
                  <div className="p-6">
                    <h1 className="text-2xl font-bold mb-4">Service Area Settings</h1>
                    <p className="text-muted-foreground">Service area configuration coming soon...</p>
                  </div>
                } />
                <Route path="/profile" element={<WorkerProfileSettings />} />
                <Route path="/archived" element={
                  <WorkerJobsTab
                    jobs={jobs}
                    onStatusUpdate={updateJobStatus}
                    onJobCancelled={handleJobCancelled}
                    initialTab="archived"
                  />
                } />
                <Route path="*" element={<Navigate to="/worker-dashboard" replace />} />
              </Routes>
            </main>
            </div>
          </div>
        </div>

        <CoverageNotifications />
        
        {/* TODO: Add CreateBookingModal when available */}
        
        <TourManager />
      </SidebarProvider>
    </TourProvider>
  );
}