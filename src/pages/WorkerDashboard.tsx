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
import CreateBookingModal from '@/components/worker/CreateBookingModal';
import TestBookingCreator from '@/components/worker/TestBookingCreator';
import CoverageNotifications from '@/components/worker/CoverageNotifications';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

const WorkerDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Set up real-time subscriptions only when user data is available
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'worker',
    onBookingUpdate: (updatedBooking) => {
      console.log('Real-time booking update received:', updatedBooking);
      setJobs(currentJobs => {
        const existingJobIndex = currentJobs.findIndex(job => job.id === updatedBooking.id);
        
        if (existingJobIndex >= 0) {
          // Update existing job
          const updatedJobs = [...currentJobs];
          updatedJobs[existingJobIndex] = { ...updatedJobs[existingJobIndex], ...updatedBooking };
          console.log('Updated existing job:', updatedJobs[existingJobIndex]);
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
    console.log('Auth state changed:', { user: !!user, profile: profile?.role, authLoading });
    
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

  const fetchWorkerJobs = async () => {
    if (!user || !profile || profile.role !== 'worker') {
      console.log('Cannot fetch jobs: missing user or invalid role');
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching jobs for worker:', user.id);

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone),
          service:services!service_id(name, description, base_price, duration_minutes)
        `)
        .eq('worker_id', user.id)
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Raw jobs data:', data);

      // Transform data to match expected format
      const transformedJobs = (data || []).map(job => ({
        ...job,
        scheduled_at: `${job.scheduled_date}T${job.scheduled_start}`,
        customer_address: job.location_notes || 'No address provided',
        total_price: job.service?.base_price || 0,
        total_duration_minutes: job.service?.duration_minutes || 60,
        services: job.service ? [job.service] : [],
        // Ensure customer data is properly nested and accessible
        customer: job.customer || null
      }));

      console.log('Transformed jobs:', transformedJobs);
      console.log('First job customer data:', transformedJobs[0]?.customer);
      setJobs(transformedJobs);

      toast({
        title: "Jobs Loaded",
        description: `Loaded ${transformedJobs.length} jobs successfully`,
      });
    } catch (error) {
      console.error('Error fetching worker jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load your jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: BookingStatus) => {
    try {
      console.log('Updating job status:', jobId, newStatus);

      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      // If job is marked as completed, automatically capture payment
      if (newStatus === 'completed') {
        console.log('Job completed, capturing payment automatically...');
        
        try {
          const { data: captureResult, error: captureError } = await supabase.functions.invoke('capture-payment-intent', {
            body: { bookingId: jobId }
          });

          if (captureError) {
            console.error('Payment capture failed:', captureError);
            toast({
              title: "Job Completed",
              description: "Job marked as completed, but payment capture failed. Please contact admin.",
              variant: "destructive",
            });
          } else if (captureResult?.success) {
            toast({
              title: "Job Completed & Payment Captured",
              description: `Job completed successfully and payment of $${captureResult.amount_captured?.toFixed(2)} has been captured.`,
            });
          } else {
            toast({
              title: "Job Completed",
              description: "Job marked as completed. Payment capture status unknown.",
            });
          }
        } catch (captureError) {
          console.error('Payment capture error:', captureError);
          toast({
            title: "Job Completed",
            description: "Job marked as completed, but payment capture failed. Please contact admin.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success",
          description: `Job status updated to ${newStatus}`,
        });
      }

      // Update local state immediately for responsive UI
      setJobs(jobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      ));

    } catch (error) {
      console.error('Error updating job status:', error);
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
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
      description: "New booking created successfully",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <WorkerDashboardHeader workerName={profile?.name || 'Worker'} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            {isConnected && (
              <p className="text-sm text-green-400">● Live updates enabled</p>
            )}
            <p className="text-sm text-gray-400">Loaded {jobs.length} jobs</p>
          </div>
          <Button 
            onClick={() => setShowCreateBooking(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Booking
          </Button>
        </div>

        {/* Add Coverage Notifications at the top */}
        <div className="mb-6">
          <CoverageNotifications />
        </div>

        {/* Test booking creator for development */}
        {process.env.NODE_ENV === 'development' && (
          <TestBookingCreator />
        )}

        <WorkerDashboardStats
          todaysJobs={todaysJobs.length}
          upcomingJobs={upcomingJobs.length}
          completedJobs={completedJobs.length}
          todaysEarnings={todaysEarnings}
        />

        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700">
            <TabsTrigger value="jobs" className="text-white data-[state=active]:bg-slate-700">My Jobs</TabsTrigger>
            <TabsTrigger value="calendar" className="text-white data-[state=active]:bg-slate-700">Calendar</TabsTrigger>
            <TabsTrigger value="schedule" className="text-white data-[state=active]:bg-slate-700">Set Schedule</TabsTrigger>
          </TabsList>
          
          <TabsContent value="jobs" className="mt-6">
            <WorkerJobsTab 
              jobs={jobs}
              onStatusUpdate={updateJobStatus}
              onJobCancelled={handleJobCancelled}
            />
          </TabsContent>
          
          <TabsContent value="calendar" className="mt-6">
            <WorkerCalendar />
          </TabsContent>
          
          <TabsContent value="schedule" className="mt-6">
            <WorkerScheduleManager onScheduleUpdate={fetchWorkerJobs} />
          </TabsContent>
        </Tabs>
      </div>

      {showCreateBooking && (
        <CreateBookingModal
          onClose={() => setShowCreateBooking(false)}
          onBookingCreated={handleBookingCreated}
        />
      )}
    </div>
  );
};

export default WorkerDashboard;
