
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkerScheduleOperations } from '@/hooks/useWorkerScheduleOperations';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { ScheduleCalendar } from './schedule/ScheduleCalendar';
import { ScheduleList } from './schedule/ScheduleList';
import { ScheduleFormModal } from './schedule/ScheduleFormModal';
import { ScheduleConnectionStatus } from './schedule/ScheduleConnectionStatus';
import { WeeklyAvailabilityManager } from './WeeklyAvailabilityManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkerScheduleManagerProps {
  onScheduleUpdate?: () => void;
  workerId?: string; // Optional workerId for admin viewing other workers
}

const WorkerScheduleManager = ({ onScheduleUpdate, workerId }: WorkerScheduleManagerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
    notes: ''
  });
  
  const { user } = useAuth();
  
  // Use the provided workerId or fall back to authenticated user
  const targetWorkerId = workerId || user?.id;
  
  const { createOrUpdateSchedule, deleteSchedule, fetchSchedulesForDate, loading } = useWorkerScheduleOperations(workerId);

  // Use calendar sync for real-time updates
  const { isConnected } = useCalendarSync({
    userId: targetWorkerId,
    userRole: 'worker',
    onScheduleUpdate: () => {
      loadSchedulesForDate(selectedDate);
      if (onScheduleUpdate) onScheduleUpdate();
    }
  });

  // Monitor network connection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (targetWorkerId && isOnline) {
      loadSchedulesForDate(selectedDate);
    }
  }, [selectedDate, targetWorkerId, isOnline]);

  const loadSchedulesForDate = async (date: Date) => {
    setFetchError(null);
    const result = await fetchSchedulesForDate(date);
    
    if (result.error) {
      setFetchError(result.error);
      setSchedules([]);
    } else {
      setSchedules(result.data);
    }
  };

  const handleSaveSchedule = async () => {
    if (!targetWorkerId || !isOnline) return;
    
    try {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      const result = await createOrUpdateSchedule({
        date: formattedDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        isAvailable: formData.isAvailable,
        notes: formData.notes
      });

      if (!result.error) {
        await loadSchedulesForDate(selectedDate);
        setShowAddModal(false);
        setEditingSchedule(null);
        resetForm();
        if (onScheduleUpdate) onScheduleUpdate();
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!isOnline) return;
    
    const result = await deleteSchedule(scheduleId);
    
    if (!result.error) {
      await loadSchedulesForDate(selectedDate);
      if (onScheduleUpdate) onScheduleUpdate();
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

  const handleAddSchedule = () => {
    resetForm();
    setEditingSchedule(null);
    setShowAddModal(true);
  };

  const handleEditSchedule = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      isAvailable: schedule.is_available,
      notes: schedule.notes || ''
    });
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingSchedule(null);
    resetForm();
  };

  // Update connection status to show both network and real-time status
  const enhancedIsOnline = isOnline && isConnected;

  // Determine if we should show edit controls (only if it's the user's own schedule or admin)
  const canEdit = !workerId || user?.id === workerId;

  return (
    <div className="w-full max-w-7xl mx-auto">
      <ScheduleConnectionStatus isOnline={enhancedIsOnline} fetchError={fetchError} />

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily">Daily Schedule</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Availability</TabsTrigger>
        </TabsList>
        
        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScheduleCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              isOnline={enhancedIsOnline}
            />

            <ScheduleList
              selectedDate={selectedDate}
              schedules={schedules}
              fetchError={fetchError}
              isOnline={enhancedIsOnline}
              onAddSchedule={canEdit ? handleAddSchedule : undefined}
              onEditSchedule={canEdit ? handleEditSchedule : undefined}
              onDeleteSchedule={canEdit ? handleDeleteSchedule : undefined}
              onRetryLoad={() => loadSchedulesForDate(selectedDate)}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="weekly">
          <WeeklyAvailabilityManager workerId={workerId} />
        </TabsContent>
      </Tabs>

      {canEdit && (
        <ScheduleFormModal
          isOpen={showAddModal}
          onClose={handleCloseModal}
          isEditing={!!editingSchedule}
          formData={formData}
          onFormDataChange={setFormData}
          onSave={handleSaveSchedule}
          loading={loading}
          isOnline={enhancedIsOnline}
        />
      )}
    </div>
  );
};

export default WorkerScheduleManager;
