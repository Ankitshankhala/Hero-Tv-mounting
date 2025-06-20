
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, MapPin, Clock, User, Mail, Phone, CheckCircle, Calendar } from 'lucide-react';
import { ValidatedInput } from '@/components/ui/ValidatedInput';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useBookingLogic } from '@/hooks/useBookingLogic';
import { useToast } from '@/hooks/use-toast';
import type { CartItem } from '@/types';

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
  const [zipcodeValid, setZipcodeValid] = useState(false);
  const [cityState, setCityState] = useState('');
  const { toast } = useToast();
  const { createBooking } = useBookingLogic();

  const validationRules = {
    name: { required: true, type: 'name' as const, minLength: 2, maxLength: 50 },
    email: { required: true, type: 'email' as const },
    phone: { required: true, type: 'phone' as const },
    address: { required: true, type: 'address' as const, minLength: 10, maxLength: 100 },
    zipcode: { required: true, type: 'zipcode' as const },
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

  const handleZipcodeChange = (zipcode: string, cityStateData?: string) => {
    setFormData(prev => ({ ...prev, zipcode }));
    if (cityStateData) {
      setCityState(cityStateData);
    }
  };

  const handleZipcodeValidation = (isValid: boolean) => {
    setZipcodeValid(isValid);
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
    
    if (!validateAllFields(formData)) {
      toast({
        title: "Validation Error",
        description: "Please correct the errors in the form",
        variant: "destructive",
      });
      return;
    }

    if (!zipcodeValid) {
      toast({
        title: "Invalid Zipcode",
        description: "Please enter a valid US zipcode",
        variant: "destructive",
      });
      return;
    }

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
      const bookingData = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        customer_zipcode: formData.zipcode,
        service_id: cart[0].id,
        scheduled_date: formData.date,
        scheduled_start: formData.time,
        location_notes: `${formData.address}\n\nServices: ${cart.map(item => `${item.name} (${item.quantity}x)`).join(', ')}\n\nSpecial Instructions: ${formData.specialInstructions}`,
        total_price: total,
        duration_minutes: calculateTotalDuration()
      };

      const result = await createBooking(bookingData);
      
      if (result.status === 'confirmed' || result.status === 'pending') {
        toast({
          title: "Booking Confirmed",
          description: result.message,
        });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        throw new Error(result.message);
      }

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Book Your Service</h2>
            <p className="text-blue-100 mt-1">Complete your booking in just a few steps</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Service Summary */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Service Summary
              </h3>
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-blue-100 last:border-b-0">
                    <div>
                      <span className="font-medium text-gray-800">{item.name}</span>
                      <span className="text-gray-600 ml-2">(x{item.quantity})</span>
                    </div>
                    <span className="font-semibold text-blue-600">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t-2 border-blue-200 pt-3 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total Amount:</span>
                    <span className="text-2xl font-bold text-blue-600">${total.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                    💳 Payment will be collected by our technician upon service completion
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center border-b border-gray-200 pb-3">
                <User className="h-6 w-6 text-blue-600 mr-3" />
                Contact Information
              </h3>
              
              <div className="bg-white border-2 border-gray-100 rounded-xl p-6 space-y-6">
                {/* First Row: Full Name and Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center text-sm font-medium text-gray-700 after:content-['*'] after:ml-0.5 after:text-red-500">
                      <User className="h-4 w-4 text-blue-600 mr-2" />
                      Full Name
                    </Label>
                    <ValidatedInput
                      id="name"
                      label=""
                      value={formData.name}
                      onChange={(value) => handleInputChange('name', value)}
                      onBlur={() => handleBlur('name')}
                      error={errors.name}
                      touched={touched.name}
                      required
                      autoFormat="name"
                      placeholder="Enter your full name"
                      className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-12"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center text-sm font-medium text-gray-700 after:content-['*'] after:ml-0.5 after:text-red-500">
                      <Mail className="h-4 w-4 text-blue-600 mr-2" />
                      Email Address
                    </Label>
                    <ValidatedInput
                      id="email"
                      label=""
                      type="email"
                      value={formData.email}
                      onChange={(value) => handleInputChange('email', value)}
                      onBlur={() => handleBlur('email')}
                      error={errors.email}
                      touched={touched.email}
                      required
                      placeholder="your.email@example.com"
                      className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-12"
                    />
                  </div>
                </div>

                {/* Second Row: Phone Number and ZIP Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center text-sm font-medium text-gray-700 after:content-['*'] after:ml-0.5 after:text-red-500">
                      <Phone className="h-4 w-4 text-blue-600 mr-2" />
                      Phone Number
                    </Label>
                    <ValidatedInput
                      id="phone"
                      label=""
                      type="tel"
                      value={formData.phone}
                      onChange={(value) => handleInputChange('phone', value)}
                      onBlur={() => handleBlur('phone')}
                      error={errors.phone}
                      touched={touched.phone}
                      required
                      autoFormat="phone"
                      placeholder="(555) 123-4567"
                      className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-12"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="zipcode" className="flex items-center text-sm font-medium text-gray-700 after:content-['*'] after:ml-0.5 after:text-red-500">
                      <MapPin className="h-4 w-4 text-blue-600 mr-2" />
                      ZIP Code
                    </Label>
                    <ZipcodeInput
                      id="zipcode"
                      label=""
                      value={formData.zipcode}
                      onChange={handleZipcodeChange}
                      onValidation={handleZipcodeValidation}
                      required
                      placeholder="Enter 5-digit ZIP code"
                      className="[&_input]:border-2 [&_input]:border-gray-200 [&_input]:focus:border-blue-500 [&_input]:rounded-lg [&_input]:h-12"
                    />
                  </div>
                </div>

                {cityState && zipcodeValid && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-green-700 flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">Service Area Confirmed:</span>
                      <span className="font-medium">{cityState}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Service Address */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center border-b border-gray-200 pb-3">
                <MapPin className="h-6 w-6 text-blue-600 mr-3" />
                Service Location
              </h3>
              
              <div className="bg-white border-2 border-gray-100 rounded-xl p-6">
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center text-sm font-medium text-gray-700 after:content-['*'] after:ml-0.5 after:text-red-500">
                    <MapPin className="h-4 w-4 text-blue-600 mr-2" />
                    Complete Service Address
                  </Label>
                  <ValidatedInput
                    id="address"
                    label=""
                    value={formData.address}
                    onChange={(value) => handleInputChange('address', value)}
                    onBlur={() => handleBlur('address')}
                    error={errors.address}
                    touched={touched.address}
                    required
                    autoFormat="address"
                    placeholder="123 Main Street, Apartment 4B, City, State"
                    className="border-2 border-gray-200 focus:border-blue-500 rounded-lg h-12"
                  />
                </div>
              </div>
            </div>

            {/* Scheduling */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center border-b border-gray-200 pb-2">
                <Calendar className="h-5 w-5 text-blue-600 mr-2" />
                Schedule Your Service
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center space-x-2 text-sm font-medium after:content-['*'] after:ml-0.5 after:text-red-500">
                    <Clock className="h-4 w-4 text-blue-600" />
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
                    className={`bg-white border-2 rounded-lg ${hasError('date') ? "border-red-500" : "border-gray-200 focus:border-blue-500"}`}
                  />
                  {hasError('date') && (
                    <p className="text-sm text-red-500">{errors.date}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-sm font-medium after:content-['*'] after:ml-0.5 after:text-red-500">
                    Preferred Time
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange('time', e.target.value)}
                    onBlur={() => handleBlur('time')}
                    required
                    className={`bg-white border-2 rounded-lg ${hasError('time') ? "border-red-500" : "border-gray-200 focus:border-blue-500"}`}
                  />
                  {hasError('time') && (
                    <p className="text-sm text-red-500">{errors.time}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-4">
              <Label htmlFor="specialInstructions" className="text-lg font-bold text-gray-900">
                Special Instructions (Optional)
              </Label>
              <Textarea
                id="specialInstructions"
                value={formData.specialInstructions}
                onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                placeholder="Any special instructions, access codes, or additional details for our technician..."
                rows={4}
                className="bg-white border-2 border-gray-200 focus:border-blue-500 rounded-lg resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                disabled={isProcessing || !zipcodeValid}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Confirm Booking'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="px-8 py-3 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 rounded-lg transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
