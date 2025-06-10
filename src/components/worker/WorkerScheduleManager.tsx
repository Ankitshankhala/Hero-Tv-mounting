
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Set Your Availability</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-md border border-slate-600"
          />
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex justify-between items-center">
            Schedule for {selectedDate.toLocaleDateString()}
            <Button 
              onClick={() => {
                resetForm();
                setEditingSchedule(null);
                setShowAddModal(true);
              }}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Time Slot
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No schedule set for this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span className="text-white">
                          {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                        </span>
                        <Badge variant={schedule.is_available ? 'default' : 'secondary'}>
                          {schedule.is_available ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                      {schedule.notes && (
                        <p className="text-slate-300 text-sm">{schedule.notes}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(schedule)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
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

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingSchedule ? 'Edit Schedule' : 'Add Time Slot'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime" className="text-white">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="endTime" className="text-white">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white"
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
              <Label htmlFor="isAvailable" className="text-white">Available for bookings</Label>
            </div>

            <div>
              <Label htmlFor="notes" className="text-white">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Any special notes for this time slot..."
                className="bg-slate-700 border-slate-600 text-white"
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
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveSchedule}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
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
