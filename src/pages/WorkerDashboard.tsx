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
import GoogleCalendarIntegration from '@/components/GoogleCalendarIntegration';
import BookingCalendarSync from '@/components/BookingCalendarSync';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

const WorkerDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Set up real-time subscriptions
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'worker',
    onBookingUpdate: (updatedBooking) => {
      setJobs(currentJobs => {
        const existingJobIndex = currentJobs.findIndex(job => job.id === updatedBooking.id);
        
        if (existingJobIndex >= 0) {
          // Update existing job
          const updatedJobs = [...currentJobs];
          updatedJobs[existingJobIndex] = { ...updatedJobs[existingJobIndex], ...updatedBooking };
          return updatedJobs;
        } else if (updatedBooking.worker_id === user?.id) {
          // Add new job if it's assigned to this worker
          fetchWorkerJobs(); // Refetch to get complete data with relations
          return currentJobs;
        }
        
        return currentJobs;
      });
    }
  });

  useEffect(() => {
    if (user && profile?.role === 'worker') {
      fetchWorkerJobs();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  const fetchWorkerJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone)
        `)
        .eq('worker_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      setJobs(data || []);
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
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      // Update local state immediately for responsive UI
      setJobs(jobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      ));

      toast({
        title: "Success",
        description: `Job status updated to ${newStatus}`,
      });
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
    // Refresh the jobs list when a job is cancelled
    fetchWorkerJobs();
  };

  const handleBookingCreated = () => {
    // Refresh the jobs list when a new booking is created
    fetchWorkerJobs();
    toast({
      title: "Success",
      description: "New booking created successfully",
    });
  };

  // Show login form if not authenticated or not a worker
  if (!user || profile?.role !== 'worker') {
    return <WorkerLoginForm />;
  }

  if (loading) {
    return <WorkerDashboardLoading />;
  }

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
          </div>
          <Button 
            onClick={() => setShowCreateBooking(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Booking
          </Button>
        </div>

        <WorkerDashboardStats
          todaysJobs={todaysJobs.length}
          upcomingJobs={upcomingJobs.length}
          completedJobs={completedJobs.length}
          todaysEarnings={todaysEarnings}
        />

        {/* Google Calendar Integration Card */}
        <div className="mb-6">
          <GoogleCalendarIntegration 
            onConnectionChange={(connected) => setIsCalendarConnected(connected)}
          />
        </div>

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

      {/* Calendar sync components for all jobs when calendar is connected */}
      {isCalendarConnected && jobs.map((job) => (
        <BookingCalendarSync
          key={job.id}
          booking={{
            id: job.id,
            service: `Job #${job.id.slice(0, 8)}`,
            date: new Date(job.scheduled_at).toISOString().split('T')[0],
            time: new Date(job.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            address: job.customer_address,
            worker: profile?.name,
            status: job.status
          }}
          action="create"
          onEventCreated={(eventId) => {
            console.log(`Calendar event created for job ${job.id}: ${eventId}`);
          }}
        />
      ))}
    </div>
  );
};

export default WorkerDashboard;
