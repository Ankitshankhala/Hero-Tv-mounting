
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkerScheduleOperations } from '@/hooks/useWorkerScheduleOperations';
import { ScheduleCalendar } from './schedule/ScheduleCalendar';
import { ScheduleList } from './schedule/ScheduleList';
import { ScheduleFormModal } from './schedule/ScheduleFormModal';
import { ScheduleConnectionStatus } from './schedule/ScheduleConnectionStatus';

interface WorkerScheduleManagerProps {
  onScheduleUpdate?: () => void;
}

const WorkerScheduleManager = ({ onScheduleUpdate }: WorkerScheduleManagerProps) => {
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
  const { createOrUpdateSchedule, deleteSchedule, fetchSchedulesForDate, loading } = useWorkerScheduleOperations();

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
    if (user && isOnline) {
      loadSchedulesForDate(selectedDate);
    }
  }, [selectedDate, user, isOnline]);

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
    if (!user || !isOnline) return;
    
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

  return (
    <div className="w-full max-w-7xl mx-auto">
      <ScheduleConnectionStatus isOnline={isOnline} fetchError={fetchError} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScheduleCalendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          isOnline={isOnline}
        />

        <ScheduleList
          selectedDate={selectedDate}
          schedules={schedules}
          fetchError={fetchError}
          isOnline={isOnline}
          onAddSchedule={handleAddSchedule}
          onEditSchedule={handleEditSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          onRetryLoad={() => loadSchedulesForDate(selectedDate)}
        />
      </div>

      <ScheduleFormModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        isEditing={!!editingSchedule}
        formData={formData}
        onFormDataChange={setFormData}
        onSave={handleSaveSchedule}
        loading={loading}
        isOnline={isOnline}
      />
    </div>
  );
};

export default WorkerScheduleManager;
