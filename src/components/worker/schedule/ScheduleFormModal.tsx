
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  onFormDataChange: (data: ScheduleFormData) => void;
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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            {isEditing ? 'Edit Schedule' : 'Add Time Slot'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isOnline && (
            <Alert variant="destructive">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                No internet connection. Cannot save changes.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime" className="text-gray-900">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => onFormDataChange({...formData, startTime: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                disabled={!isOnline}
              />
            </div>
            <div>
              <Label htmlFor="endTime" className="text-gray-900">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => onFormDataChange({...formData, endTime: e.target.value})}
                className="bg-white border-gray-300 text-gray-900"
                disabled={!isOnline}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isAvailable"
              checked={formData.isAvailable}
              onChange={(e) => onFormDataChange({...formData, isAvailable: e.target.checked})}
              className="rounded"
              disabled={!isOnline}
            />
            <Label htmlFor="isAvailable" className="text-gray-900">Available for bookings</Label>
          </div>

          <div>
            <Label htmlFor="notes" className="text-gray-900">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => onFormDataChange({...formData, notes: e.target.value})}
              placeholder="Any special notes for this time slot..."
              className="bg-white border-gray-300 text-gray-900"
              disabled={!isOnline}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="text-gray-700 border-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={onSave}
              disabled={loading || !isOnline}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
