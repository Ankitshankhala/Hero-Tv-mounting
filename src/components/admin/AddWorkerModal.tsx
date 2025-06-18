
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AddWorkerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
] as const;

export const AddWorkerModal = ({ onClose, onSuccess }: AddWorkerModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: ''
  });
  const [availability, setAvailability] = useState<Array<{
    day_of_week: typeof DAYS_OF_WEEK[number];
    start_time: string;
    end_time: string;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAddAvailability = () => {
    setAvailability([...availability, {
      day_of_week: 'Monday',
      start_time: '09:00',
      end_time: '17:00'
    }]);
  };

  const handleRemoveAvailability = (index: number) => {
    setAvailability(availability.filter((_, i) => i !== index));
  };

  const handleAvailabilityChange = (index: number, field: string, value: string) => {
    const updated = [...availability];
    updated[index] = { ...updated[index], [field]: value };
    setAvailability(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create the worker user
      const { data: worker, error: workerError } = await supabase
        .from('users')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          city: formData.city,
          role: 'worker'
        })
        .select()
        .single();

      if (workerError) throw workerError;

      // Add availability records with correct day_of_week format
      if (availability.length > 0) {
        const availabilityRecords = availability.map(avail => ({
          worker_id: worker.id,
          day_of_week: avail.day_of_week,
          start_time: avail.start_time,
          end_time: avail.end_time
        }));

        const { error: availabilityError } = await supabase
          .from('worker_availability')
          .insert(availabilityRecords);

        if (availabilityError) throw availabilityError;
      }

      toast({
        title: "Success",
        description: "Worker added successfully",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding worker:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add worker",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Add New Worker</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Availability Schedule</Label>
              <Button
                type="button"
                onClick={handleAddAvailability}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </div>

            {availability.map((avail, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <select
                  value={avail.day_of_week}
                  onChange={(e) => handleAvailabilityChange(index, 'day_of_week', e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  {DAYS_OF_WEEK.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <Input
                  type="time"
                  value={avail.start_time}
                  onChange={(e) => handleAvailabilityChange(index, 'start_time', e.target.value)}
                  className="w-32"
                />
                <span>to</span>
                <Input
                  type="time"
                  value={avail.end_time}
                  onChange={(e) => handleAvailabilityChange(index, 'end_time', e.target.value)}
                  className="w-32"
                />
                <Button
                  type="button"
                  onClick={() => handleRemoveAvailability(index)}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex space-x-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Adding...' : 'Add Worker'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
