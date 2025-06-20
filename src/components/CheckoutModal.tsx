import React, { useState } from 'react';
import { X, MapPin, Clock, User, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ValidatedInput } from '@/components/ui/ValidatedInput';
import { useFormValidation } from '@/hooks/useFormValidation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CartItem } from '@/pages/Index';

interface CheckoutModalProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
}

export const CheckoutModal = ({ cart, total, onClose }: CheckoutModalProps) => {
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

  const validationRules = {
    name: { required: true, type: 'name' as const, minLength: 2, maxLength: 50 },
    email: { required: true, type: 'email' as const },
    phone: { required: true, type: 'phone' as const },
    address: { required: true, type: 'address' as const, minLength: 10, maxLength: 100 },
    zipcode: { required: false, type: 'zipcode' as const },
    date: { required: true },
    time: { required: true }
  };

  const { errors, touched, validateField, validateAllFields, markFieldAsTouched, hasError } = useFormValidation(validationRules);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: string) => {
    markFieldAsTouched(field);
    validateField(field, formData[field]);
  };

  const calculateTotalDuration = () => {
    return cart.reduce((total, item) => {
      let baseDuration = 60;
      if (item.options?.numberOfTvs && item.options.numberOfTvs > 1) {
        baseDuration += (item.options.numberOfTvs - 1) * 30;
      }
      return total + (baseDuration * item.quantity);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    if (!validateAllFields(formData)) {
      toast({
        title: "Validation Error",
        description: "Please correct the errors in the form",
        variant: "destructive",
      });
      return;
    }

    // Additional date validation
    const selectedDate = new Date(`${formData.date}T${formData.time}:00`);
    const now = new Date();
    if (selectedDate <= now) {
      toast({
        title: "Invalid Date",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      
      const bookingData = {
        address: formData.address,
        scheduledAt,
        services: cart,
        totalPrice: total,
        totalDuration: calculateTotalDuration(),
        specialInstructions: formData.specialInstructions,
        zipcode: formData.zipcode,
        latitude: null,
        longitude: null
      };

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          bookingData,
          customerEmail: formData.email,
          customerName: formData.name
        }
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
        
        toast({
          title: "Redirecting to Payment",
          description: "Complete your payment to confirm your booking",
        });
        
        onClose();
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Booking Error",
        description: error.message || "Failed to process booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Book Your Service</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
            </div>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ValidatedInput
              id="name"
              label="Full Name"
              value={formData.name}
              onChange={(value) => handleInputChange('name', value)}
              onBlur={() => handleBlur('name')}
              error={errors.name}
              touched={touched.name}
              required
              autoFormat="name"
              placeholder="John Doe"
            />
            
            <ValidatedInput
              id="email"
              label="Email"
              type="email"
              value={formData.email}
              onChange={(value) => handleInputChange('email', value)}
              onBlur={() => handleBlur('email')}
              error={errors.email}
              touched={touched.email}
              required
              placeholder="john@example.com"
            />
            
            <ValidatedInput
              id="phone"
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(value) => handleInputChange('phone', value)}
              onBlur={() => handleBlur('phone')}
              error={errors.phone}
              touched={touched.phone}
              required
              autoFormat="phone"
              placeholder="(555) 123-4567"
            />
            
            <ValidatedInput
              id="zipcode"
              label="ZIP Code"
              value={formData.zipcode}
              onChange={(value) => handleInputChange('zipcode', value)}
              onBlur={() => handleBlur('zipcode')}
              error={errors.zipcode}
              touched={touched.zipcode}
              placeholder="12345"
            />
          </div>

          {/* Service Address */}
          <ValidatedInput
            id="address"
            label="Service Address"
            value={formData.address}
            onChange={(value) => handleInputChange('address', value)}
            onBlur={() => handleBlur('address')}
            error={errors.address}
            touched={touched.address}
            required
            autoFormat="address"
            placeholder="123 Main St, City, State"
          />

          {/* Scheduling */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center space-x-2 text-sm font-medium after:content-['*'] after:ml-0.5 after:text-destructive">
                <Clock className="h-4 w-4" />
                <span>Preferred Date</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                onBlur={() => handleBlur('date')}
                min={new Date().toISOString().split('T')[0]}
                required
                className={hasError('date') ? "border-destructive" : ""}
              />
              {hasError('date') && (
                <p className="text-sm text-destructive">{errors.date}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="time" className="text-sm font-medium after:content-['*'] after:ml-0.5 after:text-destructive">Preferred Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                onBlur={() => handleBlur('time')}
                required
                className={hasError('time') ? "border-destructive" : ""}
              />
              {hasError('time') && (
                <p className="text-sm text-destructive">{errors.time}</p>
              )}
            </div>
          </div>

          {/* Special Instructions */}
          <div className="space-y-2">
            <Label htmlFor="specialInstructions" className="text-sm font-medium">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              value={formData.specialInstructions}
              onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
              placeholder="Any special instructions for our technician..."
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4 pt-4">
            <Button
              type="submit"
              disabled={isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isProcessing ? 'Processing...' : 'Proceed to Payment'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-8"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
