
import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface WorkerCalendarProps {
  onDateSelect?: (date: Date, jobs: any[]) => void;
}

const WorkerCalendar = ({ onDateSelect }: WorkerCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchJobsForDate(selectedDate);
    }
  }, [selectedDate, user]);

  const fetchJobsForDate = async (date: Date) => {
    setLoading(true);
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone)
        `)
        .eq('worker_id', user.id)
        .gte('scheduled_at', startOfDay.toISOString())
        .lte('scheduled_at', endOfDay.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      
      setJobs(data || []);
      if (onDateSelect) {
        onDateSelect(date, data || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load jobs for selected date",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}hr ${mins > 0 ? `${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <CardTitle className="text-lg font-semibold">Calendar</CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            className="w-full border-0 bg-white"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center text-gray-900",
              caption_label: "text-sm font-medium text-gray-900",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-white p-0 opacity-70 hover:opacity-100 text-gray-700 border border-gray-200 rounded hover:bg-gray-50",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-gray-600 rounded-md w-9 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
              day: "h-9 w-9 p-0 font-normal text-gray-900 hover:bg-blue-50 rounded-md transition-colors",
              day_range_end: "day-range-end",
              day_selected: "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-600 focus:text-white",
              day_today: "bg-blue-100 text-blue-900 font-semibold",
              day_outside: "text-gray-400 opacity-50",
              day_disabled: "text-gray-400 opacity-50",
              day_range_middle: "aria-selected:bg-blue-50 aria-selected:text-blue-900",
              day_hidden: "invisible",
            }}
          />
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0 bg-white">
        <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
          <CardTitle className="text-lg font-semibold">
            Jobs for {selectedDate.toLocaleDateString()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No jobs scheduled for this date</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{job.customer?.name || 'Customer'}</h4>
                      <p className="text-sm text-gray-600">Job #{job.id.slice(0, 8)}</p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(job.status)}
                      <p className="text-sm font-bold text-green-600 mt-1">${job.total_price}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>{formatTime(job.scheduled_at)} • {formatDuration(job.total_duration_minutes)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-red-600" />
                      <span className="truncate">{job.customer_address}</span>
                    </div>
                    {job.customer?.phone && (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-green-600" />
                        <span>{job.customer.phone}</span>
                      </div>
                    )}
                  </div>

                  {job.special_instructions && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                      <strong>Instructions:</strong> {job.special_instructions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerCalendar;
