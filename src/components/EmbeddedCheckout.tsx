
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, MapPin, Clock, User, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CartItem } from '@/pages/Index';

interface EmbeddedCheckoutProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmbeddedCheckout = ({ cart, total, onClose, onSuccess }: EmbeddedCheckoutProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    zipcode: '',
    date: '',
    time: '',
    specialInstructions: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const calculateTotalDuration = () => {
    return cart.reduce((total, item) => {
      let baseDuration = 60;
      if (item.options?.numberOfTvs && item.options.numberOfTvs > 1) {
        baseDuration += (item.options.numberOfTvs - 1) * 30;
      }
      if (item.options?.cableConcealment === 'in-wall') {
        baseDuration += 45;
      }
      return total + (baseDuration * item.quantity);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.date || !formData.time) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      console.log('Creating unpaid booking...');
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      
      // Create the booking directly without payment
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_address: formData.address,
          scheduled_at: scheduledAt,
          services: cart,
          total_price: total,
          total_duration_minutes: calculateTotalDuration(),
          special_instructions: formData.specialInstructions,
          customer_zipcode: formData.zipcode,
          customer_latitude: null,
          customer_longitude: null,
          status: 'pending',
          pending_payment_amount: total
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        throw new Error(bookingError.message || 'Failed to create booking');
      }

      // Create or update user record
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', formData.email)
        .single();

      let userId = existingUser?.id;

      if (!existingUser) {
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            zipcode: formData.zipcode
          })
          .select('id')
          .single();

        if (userError) {
          console.warn('User creation failed:', userError);
        } else {
          userId = newUser.id;
        }
      }

      // Update booking with customer_id if we have one
      if (userId) {
        await supabase
          .from('bookings')
          .update({ customer_id: userId })
          .eq('id', booking.id);
      }

      console.log('Booking created successfully');
      
      toast({
        title: "Booking Confirmed",
        description: "Your service has been booked! Payment will be collected by the technician.",
      });

      // Small delay to show success message before closing
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);

    } catch (error: any) {
      console.error('Booking error:', error);
      
      toast({
        title: "Booking Error",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Book Your Service</h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Service Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Service Summary</h3>
            {cart.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2">
                <span className="text-gray-700">{item.name} (x{item.quantity})</span>
                <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total:</span>
                <span className="text-blue-600">${total.toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Payment will be collected by the technician</p>
            </div>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Full Name *</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>Email *</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>Phone Number *</span>
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="zipcode">ZIP Code</Label>
              <Input
                id="zipcode"
                name="zipcode"
                value={formData.zipcode}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
          </div>

          {/* Service Address */}
          <div>
            <Label htmlFor="address" className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Service Address *</span>
            </Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter full address where service will be performed"
              required
              className="mt-1"
            />
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Preferred Date *</span>
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="time">Preferred Time *</Label>
              <Input
                id="time"
                name="time"
                type="time"
                value={formData.time}
                onChange={handleInputChange}
                required
                className="mt-1"
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <Label htmlFor="specialInstructions">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              name="specialInstructions"
              value={formData.specialInstructions}
              onChange={handleInputChange}
              placeholder="Any special instructions for our technician..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isProcessing ? 'Processing...' : 'Book Service'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="px-8"
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
