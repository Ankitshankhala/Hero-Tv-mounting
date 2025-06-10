
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkerDashboardHeader from '@/components/worker/WorkerDashboardHeader';
import WorkerDashboardStats from '@/components/worker/WorkerDashboardStats';
import WorkerJobCard from '@/components/worker/WorkerJobCard';
import WorkerCalendar from '@/components/worker/WorkerCalendar';
import WorkerScheduleManager from '@/components/worker/WorkerScheduleManager';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

const WorkerDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { user, profile, signIn } = useAuth();
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

  const handleWorkerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const { error } = await signIn(loginForm.email, loginForm.password);
      
      if (error) {
        toast({
          title: "Login Failed",
          description: error.message || "Invalid credentials",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Logged in successfully",
      });
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Show login form if not authenticated or not a worker
  if (!user || profile?.role !== 'worker') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 p-8 w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-white text-2xl">Worker Login</CardTitle>
          </CardHeader>
          <CardContent>
            {!user ? (
              <form onSubmit={handleWorkerLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-white">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            ) : (
              <div className="text-center text-white">
                <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                <p className="text-slate-300 mb-4">This dashboard is only available to workers.</p>
                <Link to="/" className="inline-block">
                  <Button variant="outline">Return Home</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-white">Loading your jobs...</p>
        </div>
      </div>
    );
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
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">My Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No jobs assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <WorkerJobCard
                        key={job.id}
                        job={job}
                        onStatusUpdate={updateJobStatus}
                        onJobCancelled={handleJobCancelled}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
