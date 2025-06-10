
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
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar Card */}
        <Card className="w-full">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="text-lg font-semibold text-center">Calendar</CardTitle>
            <p className="text-sm text-blue-100 text-center">View scheduled jobs and appointments</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="w-full mx-auto"
                classNames={{
                  months: "flex flex-col space-y-4 w-full",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-medium",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] text-center p-0 min-w-0",
                  row: "flex w-full mt-1",
                  cell: "text-center text-sm p-0 relative flex-1 min-w-0 aspect-square",
                  day: "h-8 w-8 p-0 font-normal hover:bg-accent rounded-md transition-colors mx-auto flex items-center justify-center text-xs",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground font-semibold",
                  day_outside: "text-muted-foreground opacity-50",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_hidden: "invisible",
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Jobs Card */}
        <Card className="w-full">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
            <CardTitle className="text-lg font-semibold text-center">
              Jobs for {selectedDate.toLocaleDateString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No jobs scheduled for this date</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-card rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-card-foreground">{job.customer?.name || 'Customer'}</h4>
                        <p className="text-sm text-muted-foreground">Job #{job.id.slice(0, 8)}</p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(job.status)}
                        <p className="text-sm font-bold text-green-600 mt-1">${job.total_price}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
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
    </div>
  );
};

export default WorkerCalendar;
