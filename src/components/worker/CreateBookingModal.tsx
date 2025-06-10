
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CreateBookingModalProps {
  onClose: () => void;
  onBookingCreated: () => void;
}

interface Service {
  id: string;
  name: string;
  base_price: number;
  duration_minutes: number;
}

interface ServiceSelection {
  service: Service;
  quantity: number;
}

export const CreateBookingModal = ({ onClose, onBookingCreated }: CreateBookingModalProps) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    date: '',
    time: '',
    address: '',
    specialInstructions: ''
  });
  
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    }
  };

  const addService = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service && !selectedServices.find(ss => ss.service.id === serviceId)) {
      setSelectedServices([...selectedServices, { service, quantity: 1 }]);
    }
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(ss => ss.service.id !== serviceId));
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    setSelectedServices(selectedServices.map(ss => 
      ss.service.id === serviceId ? { ...ss, quantity } : ss
    ));
  };

  const calculateTotal = () => {
    return selectedServices.reduce((total, ss) => total + (ss.service.base_price * ss.quantity), 0);
  };

  const calculateDuration = () => {
    return selectedServices.reduce((total, ss) => total + (ss.service.duration_minutes * ss.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one service",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create customer first
      const { data: customerData, error: customerError } = await supabase
        .from('users')
        .insert({
          name: formData.customerName,
          email: formData.customerEmail,
          phone: formData.customerPhone,
          role: 'customer'
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Create booking
      const scheduledAt = new Date(`${formData.date}T${formData.time}`);
      const bookingData = {
        customer_id: customerData.id,
        worker_id: user?.id,
        scheduled_at: scheduledAt.toISOString(),
        customer_address: formData.address,
        special_instructions: formData.specialInstructions,
        services: selectedServices.map(ss => ({
          id: ss.service.id,
          name: ss.service.name,
          price: ss.service.base_price,
          quantity: ss.quantity
        })),
        total_price: calculateTotal(),
        total_duration_minutes: calculateDuration(),
        status: 'confirmed'
      };

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData);

      if (bookingError) throw bookingError;

      toast({
        title: "Success",
        description: "Booking created successfully",
      });

      onBookingCreated();
      onClose();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white">Create New Booking</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName" className="text-white">Customer Name</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="customerEmail" className="text-white">Customer Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="customerPhone" className="text-white">Customer Phone</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date" className="text-white">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label htmlFor="time" className="text-white">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  required
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="address" className="text-white">Service Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full service address"
                required
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Services Selection */}
            <div>
              <Label className="text-white">Services</Label>
              <div className="mt-2 space-y-4">
                <Select onValueChange={addService}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select a service to add" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {services.filter(s => !selectedServices.find(ss => ss.service.id === s.id)).map((service) => (
                      <SelectItem key={service.id} value={service.id} className="text-white">
                        {service.name} - ${service.base_price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedServices.map((ss) => (
                  <div key={ss.service.id} className="flex items-center justify-between bg-slate-700 p-3 rounded-lg">
                    <div className="text-white">
                      <span className="font-medium">{ss.service.name}</span>
                      <span className="text-slate-400 ml-2">${ss.service.base_price} each</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="1"
                        value={ss.quantity}
                        onChange={(e) => updateQuantity(ss.service.id, parseInt(e.target.value))}
                        className="w-16 bg-slate-600 border-slate-500 text-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeService(ss.service.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <Label htmlFor="specialInstructions" className="text-white">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={formData.specialInstructions}
                onChange={(e) => setFormData({...formData, specialInstructions: e.target.value})}
                placeholder="Any special instructions..."
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Total */}
            {selectedServices.length > 0 && (
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="flex justify-between items-center text-white">
                  <span>Total Duration: {calculateDuration()} minutes</span>
                  <span className="text-xl font-bold">Total: ${calculateTotal()}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-4 pt-4">
              <Button 
                type="submit" 
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Booking'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateBookingModal;
