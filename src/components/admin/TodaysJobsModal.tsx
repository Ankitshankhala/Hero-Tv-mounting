
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Clock, MapPin, User, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TodaysJobsModalProps {
  onClose: () => void;
}

interface TodaysJob {
  id: string;
  scheduled_start: string;
  customer: {
    name: string;
    phone?: string;
  };
  service: {
    name: string;
    duration_minutes?: number;
  };
  location_notes?: string;
  worker?: {
    name: string;
    phone?: string;
  };
  status: string;
}

export const TodaysJobsModal = ({ onClose }: TodaysJobsModalProps) => {
  const [todaysJobs, setTodaysJobs] = useState<TodaysJob[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTodaysJobs();
  }, []);

  const fetchTodaysJobs = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const { data: jobsData, error } = await supabase
        .from('bookings')
        .select(`
          id,
          scheduled_start,
          location_notes,
          status,
          customer:users!customer_id(name, phone),
          service:services(name, duration_minutes),
          worker:users!worker_id(name, phone)
        `)
        .eq('scheduled_date', today)
        .in('status', ['confirmed', 'in_progress', 'completed'])
        .order('scheduled_start');

      if (error) {
        console.error('Error fetching today\'s jobs:', error);
        throw error;
      }

      setTodaysJobs(jobsData || []);
    } catch (error) {
      console.error('Error fetching today\'s jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load today's jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      in_progress: { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '1hr';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${remainingMinutes}min`;
    if (remainingMinutes === 0) return `${hours}hr`;
    return `${hours}hr ${remainingMinutes}min`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading today's jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Today's Jobs</h2>
            <p className="text-gray-600">{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {todaysJobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No jobs scheduled for today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {todaysJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{job.customer?.name || 'Unknown Customer'}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-600">{formatTime(job.scheduled_start)}</span>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {formatDuration(job.service?.duration_minutes)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">{job.id.slice(0, 8)}</span>
                      <div className="mt-1">{getStatusBadge(job.status)}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-900">{job.service?.name || 'Unknown Service'}</p>
                  </div>
                  
                  {job.location_notes && (
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                      <span className="text-sm text-gray-600">{job.location_notes}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">
                        {job.worker?.name || 'No worker assigned'}
                      </span>
                    </div>
                    {job.worker?.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{job.worker.phone}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
