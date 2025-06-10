
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeleteBookingModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onBookingDeleted: () => void;
}

export const DeleteBookingModal = ({ booking, isOpen, onClose, onBookingDeleted }: DeleteBookingModalProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Booking deleted successfully",
      });

      onBookingDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: "Error",
        description: "Failed to delete booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span>Delete Booking</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete booking #{booking.id.slice(0, 8)}? This action cannot be undone.
          </p>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> Deleting this booking will permanently remove all associated data.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleDelete} 
              disabled={loading}
              variant="destructive"
            >
              {loading ? 'Deleting...' : 'Delete Booking'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
