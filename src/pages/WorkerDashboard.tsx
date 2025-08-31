import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { SidebarProvider } from '@/components/ui/sidebar';
import { WorkerSidebar } from '@/components/worker/WorkerSidebar';
import { NotificationBellWorker } from '@/components/worker/NotificationBellWorker';
import WorkerDashboardHeader from '@/components/worker/WorkerDashboardHeader';
import WorkerDashboardStats from '@/components/worker/WorkerDashboardStats';
import WorkerJobsTab from '@/components/worker/WorkerJobsTab';
import WorkerCalendar from '@/components/worker/WorkerCalendar';
import WorkerScheduleManager from '@/components/worker/WorkerScheduleManager';
import { WorkerEarnings } from '@/components/worker/WorkerEarnings';
import { WorkerNotificationsCenter } from '@/components/worker/WorkerNotificationsCenter';
import { WorkerProfileSettings } from '@/components/worker/WorkerProfileSettings';
import WorkerLoginForm from '@/components/worker/WorkerLoginForm';
import WorkerDashboardLoading from '@/components/worker/WorkerDashboardLoading';
import { WorkerCreateBookingModal } from '@/components/worker/WorkerCreateBookingModal';
import CoverageNotifications from '@/components/worker/CoverageNotifications';
import { ServiceAreaSettings } from '@/components/worker/service-area/ServiceAreaSettings';
import type { Database } from '@/integrations/supabase/types';
import { SEO } from '@/components/SEO';
import { TourProvider } from '@/contexts/TourContext';
import { TourManager } from '@/components/tour/TourManager';
type BookingStatus = Database['public']['Enums']['booking_status'];
const WorkerDashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'dashboard');
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
    onBookingUpdate: updatedBooking => {
      console.log('Real-time booking update received:', updatedBooking);
      setJobs(currentJobs => {
        const existingJobIndex = currentJobs.findIndex(job => job.id === updatedBooking.id);
        if (existingJobIndex >= 0) {
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
      const { data: bookingsData, error: bookingsError } = await supabase.from('bookings').select(`
          *,
          customer:users!customer_id(name, phone),
          service:services!service_id(name, description, base_price, duration_minutes)
        `).eq('worker_id', user.id)
        .in('status', ['confirmed', 'completed', 'payment_authorized'])
        .order('updated_at', {
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
        const { data: bookingServicesData, error: servicesError } = await supabase
          .from('booking_services')
          .select('booking_id, service_name, quantity, base_price, configuration')
          .in('booking_id', bookingIds);

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

      // Handle payment capture for completed jobs with authorized payments
      if (newStatus === 'completed' && data?.payment_status === 'authorized') {
        console.log('Job completed with authorized payment, capturing payment automatically...');
        try {
          const {
            data: captureResult,
            error: captureError
          } = await supabase.functions.invoke('capture-payment-intent', {
            body: {
              booking_id: jobId  // Fixed: use booking_id instead of bookingId
            }
          });
          if (captureError) {
            console.error('Payment capture failed:', captureError);
            toast({
              title: "Job Completed",
              description: "Job marked as completed, but payment capture failed. Please contact admin.",
              variant: "destructive"
            });
          } else if (captureResult?.success) {
            toast({
              title: "Job Completed & Payment Captured",
              description: `Job completed successfully and payment of $${captureResult.amount_captured?.toFixed(2)} has been captured.`
            });
          } else {
            toast({
              title: "Job Completed",
              description: "Job marked as completed. Payment capture status unknown."
            });
          }
        } catch (captureError) {
          console.error('Payment capture error:', captureError);
          toast({
            title: "Job Completed",
            description: "Job marked as completed, but payment capture failed. Please contact admin.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Success",
          description: `Job status updated to ${newStatus}`
        });
      }

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

  // Handle section changes and URL sync
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setSearchParams({ section });
  };

  // Calculate stats for sidebar badges
  const today = new Date().toDateString();
  const todaysJobs = jobs.filter(job => new Date(job.scheduled_at).toDateString() === today);
  const upcomingJobs = jobs.filter(job => new Date(job.scheduled_at) > new Date());
  const archivedJobs = jobs.filter(job => job.is_archived);
  const sidebarStats = {
    todaysJobs: todaysJobs.length,
    upcomingJobs: upcomingJobs.length,
    notifications: 3, // Mock count
    archivedJobs: archivedJobs.length
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
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const todaysEarnings = todaysJobs.reduce((sum, job) => sum + job.total_price, 0);

  // Render different sections based on activeSection
  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                {isConnected && <p className="text-sm text-green-400">● Live updates enabled</p>}
                <p className="text-sm text-muted-foreground">Loaded {jobs.length} jobs</p>
              </div>
              <NotificationBellWorker onNotificationClick={handleSectionChange} />
            </div>

            <CoverageNotifications />
            
            <div data-tour="worker-earnings">
              <WorkerDashboardStats 
                todaysJobs={todaysJobs.length} 
                upcomingJobs={upcomingJobs.length} 
                completedJobs={completedJobs.length} 
                todaysEarnings={todaysEarnings} 
              />
            </div>
          </div>
        );
      case 'jobs':
        return <WorkerJobsTab jobs={jobs} onStatusUpdate={updateJobStatus} onJobCancelled={handleJobCancelled} />;
      case 'calendar':
        return <WorkerCalendar />;
      case 'schedule':
        return <WorkerScheduleManager onScheduleUpdate={fetchWorkerJobs} />;
      case 'service-area':
        return <ServiceAreaSettings />;
      case 'archived':
        return <WorkerJobsTab jobs={jobs} onStatusUpdate={updateJobStatus} onJobCancelled={handleJobCancelled} initialTab="archived" />;
      case 'earnings':
        return <WorkerEarnings />;
      case 'notifications':
        return <WorkerNotificationsCenter />;
      case 'profile':
        return <WorkerProfileSettings />;
      default:
        return renderContent(); // Default to dashboard
    }
  };

  return (
    <TourProvider>
      <SidebarProvider>
        <div className="min-h-screen w-full flex bg-background">
          <SEO title="Worker Dashboard | Hero TV Mounting" description="Manage your jobs, schedule, and live assignments." noindex />
          
          <WorkerSidebar 
            activeSection={activeSection} 
            onSectionChange={handleSectionChange}
            stats={sidebarStats}
          />

          <div className="flex-1 flex flex-col">
            <WorkerDashboardHeader workerName={profile?.name || 'Worker'} />
            
            <main className="flex-1 p-6 overflow-auto">
              {renderContent()}
            </main>
          </div>

          {showCreateBooking && (
            <WorkerCreateBookingModal 
              onClose={() => setShowCreateBooking(false)} 
              onBookingCreated={handleBookingCreated} 
            />
          )}
          
          <TourManager />
        </div>
      </SidebarProvider>
    </TourProvider>
  );
};
export default WorkerDashboard;