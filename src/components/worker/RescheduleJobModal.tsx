import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock } from 'lucide-react';

interface RescheduleJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  currentDate: string;
  currentTime: string;
  onSuccess: () => void;
}

export const RescheduleJobModal = ({ 
  isOpen, 
  onClose, 
  bookingId, 
  currentDate, 
  currentTime, 
  onSuccess 
}: RescheduleJobModalProps) => {
  const [newDate, setNewDate] = useState(currentDate);
  const [newTime, setNewTime] = useState(currentTime);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      toast({
        title: "Error",
        description: "Please select both date and time",
        variant: "destructive",
      });
      return;
    }

    // Validate that new time is in the future
    const newDateTime = new Date(`${newDate}T${newTime}`);
    if (newDateTime <= new Date()) {
      toast({
        title: "Error",
        description: "New appointment time must be in the future",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('worker-reschedule-booking', {
        body: {
          bookingId,
          newDate,
          newTime,
          note: note.trim() || undefined
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Job Rescheduled",
          description: "Job has been rescheduled. Customer has been notified of the schedule change.",
        });
        onSuccess();
        onClose();
      } else {
        throw new Error(data?.error || 'Rescheduling failed');
      }
    } catch (error) {
      console.error('Error rescheduling job:', error);
      toast({
        title: "Rescheduling Failed",
        description: error instanceof Error ? error.message : "Failed to reschedule job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewDate(currentDate);
    setNewTime(currentTime);
    setNote('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Change Job Time
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="new-date">New Date</Label>
              <Input
                id="new-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label htmlFor="new-time">New Time</Label>
              <Input
                id="new-time"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="note">Note for Customer (Optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explain the reason for rescheduling..."
              rows={3}
            />
          </div>

          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 inline mr-1" />
              Current: {new Date(currentDate + 'T' + currentTime).toLocaleString()}
            </p>
            {newDate && newTime && (
              <p className="text-sm font-medium mt-1">
                <Clock className="h-4 w-4 inline mr-1" />
                New: {new Date(newDate + 'T' + newTime).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleReschedule} disabled={loading}>
            {loading ? 'Rescheduling...' : 'Reschedule Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};