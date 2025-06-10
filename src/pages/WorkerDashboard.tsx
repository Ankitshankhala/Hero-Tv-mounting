
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import WorkerDashboardHeader from '@/components/worker/WorkerDashboardHeader';
import WorkerDashboardStats from '@/components/worker/WorkerDashboardStats';
import WorkerJobsTab from '@/components/worker/WorkerJobsTab';
import WorkerCalendar from '@/components/worker/WorkerCalendar';
import WorkerScheduleManager from '@/components/worker/WorkerScheduleManager';
import WorkerLoginForm from '@/components/worker/WorkerLoginForm';
import WorkerDashboardLoading from '@/components/worker/WorkerDashboardLoading';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

const WorkerDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();

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

      // Update local state
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
    </div>
  );
};

export default WorkerDashboard;
