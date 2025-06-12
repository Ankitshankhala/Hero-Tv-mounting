
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { WifiOff } from 'lucide-react';

interface ScheduleFormData {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  notes: string;
}

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  formData: ScheduleFormData;
  onFormDataChange: (formData: ScheduleFormData) => void;
  onSave: () => void;
  loading: boolean;
  isOnline: boolean;
}

export const ScheduleFormModal = ({
  isOpen,
  onClose,
  isEditing,
  formData,
  onFormDataChange,
  onSave,
  loading,
  isOnline
}: ScheduleFormModalProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  const updateFormData = (field: keyof ScheduleFormData, value: string | boolean) => {
    onFormDataChange({ ...formData, [field]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isEditing ? 'Edit' : 'Add'} Schedule</span>
            {!isOnline && (
              <div className="flex items-center text-sm text-red-600">
                <WifiOff className="h-4 w-4 mr-1" />
                Offline
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => updateFormData('startTime', e.target.value)}
                disabled={loading || !isOnline}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => updateFormData('endTime', e.target.value)}
                disabled={loading || !isOnline}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isAvailable"
              checked={formData.isAvailable}
              onCheckedChange={(checked) => updateFormData('isAvailable', checked)}
              disabled={loading || !isOnline}
            />
            <Label htmlFor="isAvailable">Available for bookings</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateFormData('notes', e.target.value)}
              placeholder="Any notes about this time slot..."
              disabled={loading || !isOnline}
              rows={3}
            />
          </div>

          {!isOnline && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              You're offline. Please connect to the internet to save changes.
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !isOnline}
            >
              {loading ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
