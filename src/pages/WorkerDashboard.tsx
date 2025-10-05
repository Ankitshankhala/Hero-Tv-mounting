import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import WorkerDashboardHeader from '@/components/worker/WorkerDashboardHeader';
import WorkerDashboardStats from '@/components/worker/WorkerDashboardStats';
import WorkerJobsTab from '@/components/worker/WorkerJobsTab';
import WorkerCalendar from '@/components/worker/WorkerCalendar';
import WorkerScheduleManager from '@/components/worker/WorkerScheduleManager';
import WorkerLoginForm from '@/components/worker/WorkerLoginForm';
import WorkerDashboardLoading from '@/components/worker/WorkerDashboardLoading';
import { WorkerCreateBookingModal } from '@/components/worker/WorkerCreateBookingModal';
import CoverageNotifications from '@/components/worker/CoverageNotifications';
import { ServiceAreaSettings } from '@/components/worker/service-area/ServiceAreaSettings';
import { CoverageStatusCard } from '@/components/worker/CoverageStatusCard';
import type { Database } from '@/integrations/supabase/types';
import { SEO } from '@/components/SEO';
import { TourProvider } from '@/contexts/TourContext';
import { TourManager } from '@/components/tour/TourManager';
type BookingStatus = Database['public']['Enums']['booking_status'];
const WorkerDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [activeTab, setActiveTab] = useState('jobs');
  const {
    user,
    profile,
    loading: authLoading
  } = useAuth();
  const {
    toast
  } = useToast();

  // Set up real-time subscriptions only when user data is available
  const {
    isConnected
  } = useRealtimeBookings({
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
          // Update existing job
          const updatedJobs = [...currentJobs];
          const updatedJob = {
            ...updatedJobs[existingJobIndex],
            ...updatedBooking,
            // Recompute scheduled_at if date/time fields were updated
            scheduled_at: `${updatedBooking.scheduled_date || updatedJobs[existingJobIndex].scheduled_date}T${updatedBooking.scheduled_start || updatedJobs[existingJobIndex].scheduled_start}`
          };
          updatedJobs[existingJobIndex] = updatedJob;
          console.log('Updated existing job:', updatedJob);
          return updatedJobs;
        } else if (updatedBooking.worker_id === user?.id) {
          // Add new job if it's assigned to this worker
          console.log('New job assigned, refetching jobs');
          fetchWorkerJobs(); // Refetch to get complete data with relations
          return currentJobs;
        }
        return currentJobs;
      });
    }
  });

  // Fetch jobs when user and profile are loaded
  useEffect(() => {
    console.log('Auth state changed:', {
      user: !!user,
      profile: profile?.role,
      authLoading
    });
    if (authLoading) {
      console.log('Still loading auth, waiting...');
      return;
    }
    if (!user) {
      console.log('No user found, stopping loading');
      setLoading(false);
      return;
    }
    if (!profile) {
      console.log('No profile found, waiting for profile to load...');
      return;
    }
    if (profile.role !== 'worker') {
      console.log('User is not a worker, stopping loading');
      setLoading(false);
      return;
    }
    console.log('User and profile loaded, fetching jobs...');
    fetchWorkerJobs();
  }, [user, profile, authLoading]);

  // Auto-scroll to Active Jobs section when data loads
  useEffect(() => {
    if (!loading) {
      let attempts = 0;
      const maxAttempts = 10;
      const scrollToActiveJobs = () => {
        const activeJobsSection = document.getElementById('active-jobs-section');
        if (activeJobsSection) {
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          activeJobsSection.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
          });
          return true;
        }
        return false;
      };
      const retryScroll = () => {
        if (scrollToActiveJobs()) {
          return; // Success, stop retrying
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(retryScroll, 100);
        }
      };

      // Start the retry process
      setTimeout(retryScroll, 50);
    }
  }, [loading]);
  const fetchWorkerJobs = async () => {
    if (!user || !profile || profile.role !== 'worker') {
      console.log('Cannot fetch jobs: missing user or invalid role');
      return;
    }
    try {
      setLoading(true);
      console.log('Fetching jobs for worker:', user.id);

      // Fetch bookings without booking_services to avoid FK error - only confirmed, completed, and payment_authorized
      const {
        data: bookingsData,
        error: bookingsError
      } = await supabase.from('bookings').select(`
          *,
          customer:users!customer_id(name, phone),
          service:services!service_id(name, description, base_price, duration_minutes)
        `).eq('worker_id', user.id).in('status', ['confirmed', 'completed', 'payment_authorized']).order('updated_at', {
        ascending: false
      }).order('scheduled_date', {
        ascending: true
      });
      if (bookingsError) {
        console.error('Supabase error:', bookingsError);
        throw bookingsError;
      }
      let servicesByBooking = {};
      if (bookingsData && bookingsData.length > 0) {
        // Fetch booking services separately for all bookings
        const bookingIds = bookingsData.map(booking => booking.id);
        const {
          data: bookingServicesData,
          error: servicesError
        } = await supabase.from('booking_services').select('booking_id, service_name, quantity, base_price, configuration').in('booking_id', bookingIds);
        if (servicesError) {
          console.error('Error fetching booking services:', servicesError);
        } else {
          // Group booking services by booking_id
          servicesByBooking = (bookingServicesData || []).reduce((acc, service) => {
            if (!acc[service.booking_id]) {
              acc[service.booking_id] = [];
            }
            acc[service.booking_id].push(service);
            return acc;
          }, {} as Record<string, any[]>);
        }
      }
      console.log('Raw jobs data:', bookingsData);
      console.log('Booking services data:', servicesByBooking);

      // Transform data to match expected format
      const transformedJobs = (bookingsData || []).map(job => ({
        ...job,
        booking_services: servicesByBooking[job.id] || [],
        scheduled_at: `${job.scheduled_date}T${job.scheduled_start}`,
        total_price: job.service?.base_price || 0,
        total_duration_minutes: job.service?.duration_minutes || 60,
        services: job.service ? [job.service] : [],
        // Ensure customer data is properly nested and accessible
        customer: job.customer || null
      }));
      console.log('Transformed jobs with services:', transformedJobs);
      console.log('First job customer data:', transformedJobs[0]?.customer);
      console.log('First job booking services:', transformedJobs[0]?.booking_services);
      setJobs(transformedJobs); // Keep all jobs including archived ones
      toast({
        title: "Jobs Loaded",
        description: `Loaded ${transformedJobs.length} jobs successfully`
      });
    } catch (error) {
      console.error('Error fetching worker jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load your jobs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const updateJobStatus = async (jobId: string, newStatus: BookingStatus) => {
    try {
      console.log('Updating job status:', jobId, newStatus);
      const {
        data,
        error
      } = await supabase.from('bookings').update({
        status: newStatus
      }).eq('id', jobId).select().single();
      if (error) {
        console.error('Status update error:', error);
        throw error;
      }
      console.log('Status updated successfully:', data);

      // Job marked as completed - payment capture is now a separate action
      toast({
        title: "Success",
        description: `Job status updated to ${newStatus}`
      });

      // Update local state immediately for responsive UI and refresh from server
      setJobs(prevJobs => prevJobs.map(job => job.id === jobId ? {
        ...job,
        status: newStatus
      } : job));

      // Refresh jobs to get latest data from server
      fetchWorkerJobs();
    } catch (error) {
      console.error('Error updating job status:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast({
        title: "Failed to Update Job Status",
        description: `Error: ${errorMessage}. Please try again.`,
        variant: "destructive"
      });
    }
  };
  const handleJobCancelled = () => {
    console.log('Job cancelled, refreshing jobs list');
    fetchWorkerJobs();
  };
  const handleBookingCreated = () => {
    console.log('New booking created, refreshing jobs list');
    fetchWorkerJobs();
    toast({
      title: "Success",
      description: "New booking created successfully"
    });
  };

  // Show loading while auth is initializing
  if (authLoading) {
    console.log('Showing auth loading state');
    return <WorkerDashboardLoading />;
  }

  // Show login form if not authenticated or not a worker
  if (!user || !profile || profile.role !== 'worker') {
    console.log('Showing login form - user:', !!user, 'profile role:', profile?.role);
    return <WorkerLoginForm />;
  }

  // Show loading while jobs are being fetched
  if (loading) {
    console.log('Showing jobs loading state');
    return <WorkerDashboardLoading />;
  }
  console.log('Rendering dashboard with', jobs.length, 'jobs');
  const today = new Date().toDateString();
  const todaysJobs = jobs.filter(job => new Date(job.scheduled_at).toDateString() === today);
  const upcomingJobs = jobs.filter(job => new Date(job.scheduled_at) > new Date());
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const todaysEarnings = todaysJobs.reduce((sum, job) => sum + job.total_price, 0);
  return <TourProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <SEO title="Worker Dashboard | Hero TV Mounting" description="Manage your jobs, schedule, and live assignments." noindex />
        <WorkerDashboardHeader workerName={profile?.name || 'Worker'} />

        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              {isConnected && <p className="text-sm text-green-400">● Live updates enabled</p>}
              <p className="text-sm text-gray-400">Loaded {jobs.length} jobs</p>
            </div>
          </div>

          {/* Add Coverage Status Card and Notifications */}
          

          <div data-tour="worker-earnings" className="mb-6">
            <WorkerDashboardStats todaysJobs={todaysJobs.length} upcomingJobs={upcomingJobs.length} completedJobs={completedJobs.length} todaysEarnings={todaysEarnings} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 h-auto bg-slate-800 border border-slate-700 p-1 rounded-lg">
              <TabsTrigger value="jobs" className="w-full justify-center text-white data-[state=active]:bg-slate-700" data-tour="worker-jobs">My Jobs</TabsTrigger>
              <TabsTrigger value="calendar" className="w-full justify-center text-white data-[state=active]:bg-slate-700">Calendar</TabsTrigger>
              <TabsTrigger value="schedule" className="w-full justify-center text-white data-[state=active]:bg-slate-700" data-tour="worker-schedule">Set Schedule</TabsTrigger>
              <TabsTrigger value="service-area" className="w-full justify-center text-white data-[state=active]:bg-slate-700" data-tour="worker-profile">Service Area</TabsTrigger>
            </TabsList>
            
            <TabsContent value="jobs" className="mt-6">
              <WorkerJobsTab jobs={jobs} onStatusUpdate={updateJobStatus} onJobCancelled={handleJobCancelled} />
            </TabsContent>
            
            <TabsContent value="calendar" className="mt-6">
              <WorkerCalendar />
            </TabsContent>
            
            <TabsContent value="schedule" className="mt-6">
              <WorkerScheduleManager onScheduleUpdate={fetchWorkerJobs} />
            </TabsContent>
            
            <TabsContent value="service-area" className="mt-6">
              <ServiceAreaSettings />
            </TabsContent>
          </Tabs>
        </div>

        {showCreateBooking && <WorkerCreateBookingModal onClose={() => setShowCreateBooking(false)} onBookingCreated={handleBookingCreated} />}
        
        <TourManager />
      </div>
    </TourProvider>;
};
export default WorkerDashboard;