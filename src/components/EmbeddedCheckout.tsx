import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, MapPin, Clock, User, Mail, Phone, CheckCircle, Calendar as CalendarIcon, Users, Sparkles } from 'lucide-react';
import { ValidatedInput } from '@/components/ui/ValidatedInput';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useBookingLogic } from '@/hooks/useBookingLogic';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zipcodeValid, setZipcodeValid] = useState(false);
  const [cityState, setCityState] = useState('');
  const { toast } = useToast();
  const { createBooking } = useBookingLogic();

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

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

  const fetchWorkerAvailability = async (date: Date, zipcode: string) => {
    if (!zipcode || !date) return;
    
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Fetch existing bookings for the selected date and zipcode area
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          scheduled_start,
          worker_bookings!inner(
            worker_id,
            users!inner(zip_code)
          )
        `)
        .eq('scheduled_date', dateStr)
        .eq('status', 'confirmed');

      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }

      // Filter bookings by zipcode proximity (first 3 digits)
      const zipcodePrefix = zipcode.substring(0, 3);
      const relevantBookings = bookings?.filter(booking => {
        const workerZipcode = booking.worker_bookings?.[0]?.users?.zip_code;
        return workerZipcode && workerZipcode.substring(0, 3) === zipcodePrefix;
      }) || [];

      // Count available workers in the area
      const { data: workers, error: workerError } = await supabase
        .from('users')
        .select('id, zip_code')
        .eq('role', 'worker')
        .eq('is_active', true);

      if (!workerError) {
        const availableWorkers = workers?.filter(worker => 
          worker.zip_code && worker.zip_code.substring(0, 3) === zipcodePrefix
        ) || [];
        setWorkerCount(availableWorkers.length);
      }

      // Extract blocked time slots
      const blocked = relevantBookings.map(booking => 
        booking.scheduled_start.substring(0, 5)
      );

      setBlockedSlots(blocked);
      setAvailableSlots(timeSlots.filter(slot => !blocked.includes(slot)));
    } catch (error) {
      console.error('Error fetching worker availability:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate && formData.zipcode) {
      fetchWorkerAvailability(selectedDate, formData.zipcode);
    }
  }, [selectedDate, formData.zipcode]);

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

    const selectedDateTime = new Date(`${formData.date}T${formData.time}:00`);
    const now = new Date();
    if (selectedDateTime <= now) {
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 text-white px-8 py-6 rounded-t-2xl">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Book Your Service</h2>
              <p className="text-blue-100 text-sm">Complete your booking in just a few steps</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Enhanced Service Summary */}
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-emerald-800 mb-4 flex items-center text-lg">
                <CheckCircle className="h-6 w-6 text-emerald-600 mr-3" />
                Service Summary
              </h3>
              <div className="space-y-4">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-emerald-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="font-medium text-gray-800">{item.name}</span>
                      <span className="text-emerald-600 text-sm font-medium">×{item.quantity}</span>
                    </div>
                    <span className="font-bold text-emerald-700 text-lg">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t-2 border-emerald-200 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-900">Total Amount:</span>
                    <span className="text-2xl font-bold text-emerald-700">${total.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-emerald-600 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    💳 Payment will be collected by our technician upon service completion
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Contact Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-blue-800 flex items-center mb-6">
                <User className="h-5 w-5 text-blue-600 mr-2" />
                Contact Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span>Full Name</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    placeholder="Enter your full name"
                    className="h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.name && touched.name && (
                    <p className="text-sm text-red-600">{errors.name}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span>Email Address</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    placeholder="your.email@example.com"
                    className="h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.email && touched.email && (
                    <p className="text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>Phone Number</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    onBlur={() => handleBlur('phone')}
                    placeholder="(555) 123-4567"
                    className="h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.phone && touched.phone && (
                    <p className="text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="zipcode" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span>ZIP Code</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="zipcode"
                    value={formData.zipcode}
                    onChange={(e) => handleZipcodeChange(e.target.value)}
                    placeholder="Enter 5-digit ZIP code"
                    maxLength={5}
                    className="h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                </div>
              </div>

              {cityState && zipcodeValid && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6">
                  <p className="text-sm text-green-700 flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold">Service Area Confirmed:</span>
                    <span className="font-medium">{cityState}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Enhanced Service Address */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-green-800 flex items-center mb-6">
                <MapPin className="h-5 w-5 text-green-600 mr-2" />
                Service Location
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span>Complete Service Address</span>
                  <span className="text-red-500">*</span>
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
                  className="h-12 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Schedule Service - Updated styling */}
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-purple-800 flex items-center">
                  <CalendarIcon className="h-5 w-5 text-purple-600 mr-2" />
                  Schedule Your Service
                </h3>
                {workerCount > 0 && (
                  <div className="flex items-center space-x-2 text-sm bg-purple-100 text-purple-700 px-4 py-2 rounded-full">
                    <Users className="h-4 w-4" />
                    <span>{workerCount} workers available</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendar Section */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4 text-purple-600" />
                    <span>Select Date</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setFormData(prev => ({ ...prev, date: date ? format(date, 'yyyy-MM-dd') : '' }));
                      }}
                      disabled={(date) => date < new Date()}
                      className="w-full"
                      classNames={{
                        months: "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4 w-full flex flex-col",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-medium",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex w-full",
                        head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] flex-1 text-center",
                        row: "flex w-full mt-2",
                        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1",
                        day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 mx-auto hover:bg-purple-100 rounded-md transition-colors",
                        day_selected: "bg-purple-600 text-purple-foreground hover:bg-purple-600 hover:text-purple-foreground focus:bg-purple-600 focus:text-purple-foreground",
                        day_today: "bg-purple-100 text-purple-900 font-semibold",
                        day_outside: "text-muted-foreground opacity-50",
                        day_disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
                      }}
                    />
                  </div>
                </div>

                {/* Time Slots Section */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span>Available Time Slots</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  
                  <div className="border border-gray-200 rounded-lg bg-white p-4">
                    {!selectedDate ? (
                      <div className="text-center py-8 text-gray-500">
                        <CalendarIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                        <p>Please select a date first</p>
                      </div>
                    ) : loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
                        <p className="text-gray-500">Loading availability...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>Available</span>
                            <div className="w-3 h-3 bg-red-500 rounded-full ml-4"></div>
                            <span>Booked</span>
                          </div>
                          <p className="text-xs text-gray-500">Times shown are based on worker availability in your area (ZIP: {formData.zipcode})</p>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                          {timeSlots.map((time) => {
                            const isBlocked = blockedSlots.includes(time);
                            const isSelected = formData.time === time;
                            
                            return (
                              <Button
                                key={time}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                disabled={isBlocked}
                                onClick={() => setFormData(prev => ({ ...prev, time }))}
                                className={cn(
                                  "h-12 text-sm font-medium transition-all duration-200 relative",
                                  isBlocked && "bg-red-50 text-red-600 border-red-200 cursor-not-allowed hover:bg-red-50",
                                  isSelected && "bg-purple-600 text-white border-purple-600 shadow-md",
                                  !isBlocked && !isSelected && "hover:bg-purple-50 hover:border-purple-300 bg-white border-gray-200"
                                )}
                              >
                                <div className="flex items-center space-x-2">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    isBlocked ? "bg-red-500" : "bg-green-500"
                                  )} />
                                  <span>{time}</span>
                                </div>
                                {isBlocked && (
                                  <div className="absolute inset-0 bg-red-100/50 rounded flex items-center justify-center">
                                    <span className="text-xs font-medium text-red-700">Busy</span>
                                  </div>
                                )}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-200 rounded-2xl p-6 shadow-sm">
              <Label htmlFor="specialInstructions" className="text-lg font-bold text-gray-800 mb-4 block">
                Special Instructions (Optional)
              </Label>
              <Textarea
                id="specialInstructions"
                value={formData.specialInstructions}
                onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                placeholder="Any special instructions, access codes, parking info, or specific requests..."
                className="min-h-[100px] border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg resize-none bg-white/80 transition-all duration-200"
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t-2 border-gray-200">
              <Button
                type="submit"
                disabled={isProcessing || !zipcodeValid || !selectedDate || !formData.time}
                className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700 text-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:transform-none"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  `Confirm Booking - $${total.toFixed(2)}`
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="px-8 py-3 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 rounded-xl transition-colors h-14"
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
