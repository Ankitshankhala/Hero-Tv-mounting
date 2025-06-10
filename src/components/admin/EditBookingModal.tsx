
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditBookingModalProps {
  booking: any;
  isOpen: boolean;
  onClose: () => void;
  onBookingUpdated: () => void;
}

export const EditBookingModal = ({ booking, isOpen, onClose, onBookingUpdated }: EditBookingModalProps) => {
  const [formData, setFormData] = useState({
    status: booking?.status || '',
    scheduled_at: booking?.scheduled_at || '',
    customer_address: booking?.customer_address || '',
    special_instructions: booking?.special_instructions || '',
    total_price: booking?.total_price || 0
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: formData.status,
          scheduled_at: formData.scheduled_at,
          customer_address: formData.customer_address,
          special_instructions: formData.special_instructions,
          total_price: parseFloat(formData.total_price.toString()),
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Booking updated successfully",
      });

      onBookingUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: "Error",
        description: "Failed to update booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Booking #{booking.id.slice(0, 8)}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={(value) => handleInputChange('status', value)} value={formData.status}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="total_price">Total Price</Label>
              <Input
                id="total_price"
                type="number"
                step="0.01"
                value={formData.total_price}
                onChange={(e) => handleInputChange('total_price', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="scheduled_at">Scheduled Date & Time</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={formData.scheduled_at ? new Date(formData.scheduled_at).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleInputChange('scheduled_at', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="customer_address">Customer Address</Label>
            <Input
              id="customer_address"
              value={formData.customer_address}
              onChange={(e) => handleInputChange('customer_address', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="special_instructions">Special Instructions</Label>
            <Textarea
              id="special_instructions"
              value={formData.special_instructions || ''}
              onChange={(e) => handleInputChange('special_instructions', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Booking'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
