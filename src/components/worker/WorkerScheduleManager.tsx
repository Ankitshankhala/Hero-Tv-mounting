import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface WorkerScheduleManagerProps {
  onScheduleUpdate?: () => void;
}

const WorkerScheduleManager = ({ onScheduleUpdate }: WorkerScheduleManagerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
    notes: ''
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSchedulesForDate(selectedDate);
    }
  }, [selectedDate, user]);

  const fetchSchedulesForDate = async (date: Date) => {
    try {
      const formattedDate = date.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('worker_schedules')
        .select('*')
        .eq('worker_id', user.id)
        .eq('date', formattedDate)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive",
      });
    }
  };

  const handleSaveSchedule = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .rpc('upsert_worker_schedule', {
          p_worker_id: user.id,
          p_date: formattedDate,
          p_start_time: formData.startTime,
          p_end_time: formData.endTime,
          p_is_available: formData.isAvailable,
          p_notes: formData.notes || null
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schedule updated successfully",
      });

      await fetchSchedulesForDate(selectedDate);
      setShowAddModal(false);
      setEditingSchedule(null);
      resetForm();
      if (onScheduleUpdate) onScheduleUpdate();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('worker_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schedule deleted successfully",
      });

      await fetchSchedulesForDate(selectedDate);
      if (onScheduleUpdate) onScheduleUpdate();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
      notes: ''
    });
  };

  const openEditModal = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      isAvailable: schedule.is_available,
      notes: schedule.notes || ''
    });
    setShowAddModal(true);
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar Card */}
        <Card className="w-full">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
            <CardTitle className="text-lg font-semibold text-center">Set Your Availability</CardTitle>
            <p className="text-sm text-purple-100 text-center">Select a date to manage your schedule</p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-full overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
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

        {/* Schedule Card */}
        <Card className="w-full">
          <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-t-lg">
            <div className="flex justify-between items-center">
              <div className="text-center flex-1">
                <CardTitle className="text-lg font-semibold">
                  Schedule for {selectedDate.toLocaleDateString()}
                </CardTitle>
              </div>
              <Button 
                onClick={() => {
                  resetForm();
                  setEditingSchedule(null);
                  setShowAddModal(true);
                }}
                className="bg-white text-orange-700 hover:bg-orange-50 border-0 ml-4"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Time Slot
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {schedules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No schedule set for this date</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="bg-card rounded-lg p-4 border border-border hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-card-foreground font-medium">
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </span>
                          <Badge variant={schedule.is_available ? 'default' : 'secondary'}>
                            {schedule.is_available ? 'Available' : 'Unavailable'}
                          </Badge>
                        </div>
                        {schedule.notes && (
                          <p className="text-muted-foreground text-sm">{schedule.notes}</p>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(schedule)}
                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingSchedule ? 'Edit Schedule' : 'Add Time Slot'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime" className="text-gray-900">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <Label htmlFor="endTime" className="text-gray-900">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isAvailable"
                checked={formData.isAvailable}
                onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="isAvailable" className="text-gray-900">Available for bookings</Label>
            </div>

            <div>
              <Label htmlFor="notes" className="text-gray-900">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Any special notes for this time slot..."
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingSchedule(null);
                  resetForm();
                }}
                className="text-gray-700 border-gray-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveSchedule}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? 'Saving...' : (editingSchedule ? 'Update' : 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerScheduleManager;
