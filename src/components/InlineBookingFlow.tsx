
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, User, Mail, Phone, MapPin, Calendar as CalendarIcon, Clock, ArrowRight, Shield, Star, Sparkles, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface InlineBookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  selectedServices?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export const InlineBookingFlow = ({ isOpen, onClose, onSubmit, selectedServices = [] }: InlineBookingFlowProps) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    zipcode: '',
    address: '',
    city: '',
    region: '',
    selectedDate: undefined as Date | undefined,
    selectedTime: '',
    specialInstructions: ''
  });

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const handleZipcodeChange = (zipcode: string, cityState?: string) => {
    setFormData(prev => ({ ...prev, zipcode }));
    
    if (cityState) {
      const [city, state] = cityState.split(', ');
      setFormData(prev => ({ 
        ...prev,
        city: city || prev.city,
        region: prev.region || 'downtown'
      }));
    }
  };

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
    if (formData.selectedDate && formData.zipcode) {
      fetchWorkerAvailability(formData.selectedDate, formData.zipcode);
    }
  }, [formData.selectedDate, formData.zipcode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submissionData = {
      ...formData,
      selectedServices,
      scheduledDateTime: formData.selectedDate && formData.selectedTime 
        ? `${format(formData.selectedDate, 'yyyy-MM-dd')} ${formData.selectedTime}`
        : null
    };
    onSubmit?.(submissionData);
  };

  const isFormValid = 
    formData.customerName && 
    formData.customerEmail && 
    formData.customerPhone &&
    formData.address && 
    formData.zipcode &&
    formData.selectedDate &&
    formData.selectedTime;

  const getTotalPrice = () => {
    return selectedServices.reduce((total, service) => total + (service.price * service.quantity), 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto border border-gray-100">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white px-8 py-8 rounded-t-3xl">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 hover:bg-white/20 rounded-full transition-all duration-200"
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2">Book Your Service</h2>
              <p className="text-blue-100 text-lg">Complete your booking in just a few steps</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Service Summary */}
          {selectedServices.length > 0 && (
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-green-800 flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Selected Services</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedServices.map((service) => (
                  <div key={service.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm">
                    <div>
                      <span className="font-medium text-gray-800">{service.name}</span>
                      <span className="text-green-600 text-sm ml-2">(x{service.quantity})</span>
                    </div>
                    <span className="font-bold text-green-700">${service.price * service.quantity}</span>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span className="text-gray-800">Total:</span>
                    <span className="text-green-700">${getTotalPrice()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <Card className="border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
              <CardTitle className="text-blue-800 flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span>Full Name *</span>
                  </Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerEmail" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span>Email Address *</span>
                  </Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    placeholder="your.email@example.com"
                    className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customerPhone" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>Phone Number *</span>
                  </Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <ZipcodeInput
                    id="zipcode"
                    label="ZIP Code"
                    value={formData.zipcode}
                    onChange={handleZipcodeChange}
                    required
                    placeholder="12345"
                    className="[&_label]:text-base [&_label]:font-semibold [&_label]:text-gray-700 [&_label]:flex [&_label]:items-center [&_label]:space-x-2 [&_input]:h-12 [&_input]:border-2 [&_input]:border-gray-200 [&_input]:focus:border-blue-500 [&_input]:rounded-lg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Location */}
          <Card className="border-green-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
              <CardTitle className="text-green-800 flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <span>Service Location</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span>Complete Service Address *</span>
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street, Apartment 4B, City, State"
                  className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-base font-semibold text-gray-700">
                    City *
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region" className="text-base font-semibold text-gray-700">
                    Service Region *
                  </Label>
                  <Select 
                    value={formData.region} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                  >
                    <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg">
                      <SelectValue placeholder="Select your area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="downtown">Downtown</SelectItem>
                      <SelectItem value="north-side">North Side</SelectItem>
                      <SelectItem value="east-side">East Side</SelectItem>
                      <SelectItem value="west-end">West End</SelectItem>
                      <SelectItem value="south-side">South Side</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Service */}
          <Card className="border-purple-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-lg">
              <CardTitle className="text-purple-800 flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CalendarIcon className="h-5 w-5 text-purple-600" />
                </div>
                <span>Schedule Your Service</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Calendar */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4 text-purple-600" />
                    <span>Select Date *</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal border-2 border-gray-200 hover:border-purple-500",
                          !formData.selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.selectedDate ? format(formData.selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.selectedDate}
                        onSelect={(date) => setFormData(prev => ({ ...prev, selectedDate: date }))}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time Slots */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span>Select Time *</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border-2 border-gray-200 rounded-lg p-3">
                    {timeSlots.map((time) => {
                      const isBlocked = blockedSlots.includes(time);
                      const isSelected = formData.selectedTime === time;
                      
                      return (
                        <Button
                          key={time}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          disabled={isBlocked || loading}
                          onClick={() => setFormData(prev => ({ ...prev, selectedTime: time }))}
                          className={cn(
                            "h-10 text-sm",
                            isBlocked && "bg-red-100 text-red-600 border-red-200 cursor-not-allowed",
                            isSelected && "bg-purple-600 text-white border-purple-600",
                            !isBlocked && !isSelected && "hover:bg-purple-50 hover:border-purple-300"
                          )}
                        >
                          {time}
                          {isBlocked && <span className="ml-1 text-xs">(Busy)</span>}
                        </Button>
                      );
                    })}
                  </div>
                  {loading && (
                    <p className="text-sm text-gray-500 mt-2">Loading availability...</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Special Instructions */}
          <Card className="border-gray-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-lg">
              <CardTitle className="text-gray-800">Special Instructions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                placeholder="Any special instructions, access codes, parking info, or specific requests..."
                className="min-h-[100px] border-2 border-gray-200 focus:border-blue-500 rounded-lg resize-none"
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Security Badge */}
          <div className="flex justify-center">
            <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Your information is secure and encrypted</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit"
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              disabled={!isFormValid}
            >
              <span>Complete Booking</span>
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
