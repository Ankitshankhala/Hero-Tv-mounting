
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
import { X, User, Mail, Phone, MapPin, Calendar as CalendarIcon, Clock, ArrowRight, Shield, Star, Sparkles, CheckCircle, Users } from 'lucide-react';
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
  const [workerCount, setWorkerCount] = useState<number>(0);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto border border-gray-100">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 text-white px-8 py-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <CalendarIcon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Book Your Service</h2>
              <p className="text-blue-100 text-sm">Complete your booking in just a few steps</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Service Summary - Enhanced */}
          {selectedServices.length > 0 && (
            <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-emerald-800 flex items-center space-x-2 text-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>Selected Services</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedServices.map((service) => (
                  <div key={service.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border border-emerald-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="font-medium text-gray-800">{service.name}</span>
                      <span className="text-emerald-600 text-sm font-medium">×{service.quantity}</span>
                    </div>
                    <span className="font-bold text-emerald-700 text-lg">${service.price * service.quantity}</span>
                  </div>
                ))}
                <div className="border-t border-emerald-200 pt-3 mt-3">
                  <div className="flex justify-between items-center font-bold text-xl">
                    <span className="text-gray-800">Total Amount:</span>
                    <span className="text-emerald-700">${getTotalPrice()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Contact Information */}
          <Card className="border-blue-200 shadow-md">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg border-b border-blue-100">
              <CardTitle className="text-blue-800 flex items-center space-x-3 text-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="customerName" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span>Full Name</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg bg-gray-50/50 transition-all duration-200"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="customerEmail" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span>Email Address</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    placeholder="your.email@example.com"
                    className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg bg-gray-50/50 transition-all duration-200"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="customerPhone" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>Phone Number</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg bg-gray-50/50 transition-all duration-200"
                  />
                </div>

                <div className="space-y-3">
                  <ZipcodeInput
                    id="zipcode"
                    label="ZIP Code"
                    value={formData.zipcode}
                    onChange={handleZipcodeChange}
                    required
                    placeholder="12345"
                    className="[&_label]:text-base [&_label]:font-semibold [&_label]:text-gray-700 [&_label]:flex [&_label]:items-center [&_label]:space-x-2 [&_input]:h-12 [&_input]:border-2 [&_input]:border-gray-200 [&_input]:focus:border-blue-500 [&_input]:focus:ring-blue-500/20 [&_input]:rounded-lg [&_input]:bg-gray-50/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Service Location */}
          <Card className="border-green-200 shadow-md">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg border-b border-green-100">
              <CardTitle className="text-green-800 flex items-center space-x-3 text-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <span>Service Location</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <Label htmlFor="address" className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span>Complete Service Address</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street, Apartment 4B, City, State"
                  className="h-12 border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-lg bg-gray-50/50 transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="city" className="text-base font-semibold text-gray-700">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="h-12 border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-lg bg-gray-50/50 transition-all duration-200"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="region" className="text-base font-semibold text-gray-700">
                    Service Region <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={formData.region} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                  >
                    <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg bg-gray-50/50 transition-all duration-200">
                      <SelectValue placeholder="Select your area" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-2">
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

          {/* Google Calendar Style Schedule Service */}
          <Card className="border-purple-200 shadow-md">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-lg border-b border-purple-100">
              <CardTitle className="text-purple-800 flex items-center space-x-3 text-lg">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CalendarIcon className="h-5 w-5 text-purple-600" />
                </div>
                <span>Schedule Your Service</span>
                {workerCount > 0 && (
                  <div className="ml-auto flex items-center space-x-2 text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                    <Users className="h-4 w-4" />
                    <span>{workerCount} workers available</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendar Section */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4 text-purple-600" />
                    <span>Select Date</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50/30">
                    <Calendar
                      mode="single"
                      selected={formData.selectedDate}
                      onSelect={(date) => setFormData(prev => ({ ...prev, selectedDate: date }))}
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

                {/* Time Slots Section - Google Calendar Style */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold text-gray-700 flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span>Available Time Slots</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  
                  <div className="border-2 border-gray-200 rounded-lg bg-gray-50/30 p-4">
                    {!formData.selectedDate ? (
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
                      <div className="space-y-3">
                        <div className="text-sm text-gray-600 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>Available</span>
                            <div className="w-3 h-3 bg-red-500 rounded-full ml-4"></div>
                            <span>Booked</span>
                          </div>
                          <p className="text-xs text-gray-500">Times shown are based on worker availability in your area (ZIP: {formData.zipcode})</p>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                          {timeSlots.map((time) => {
                            const isBlocked = blockedSlots.includes(time);
                            const isSelected = formData.selectedTime === time;
                            
                            return (
                              <Button
                                key={time}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                disabled={isBlocked}
                                onClick={() => setFormData(prev => ({ ...prev, selectedTime: time }))}
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
            </CardContent>
          </Card>

          {/* Special Instructions */}
          <Card className="border-gray-200 shadow-md">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-lg border-b border-gray-100">
              <CardTitle className="text-gray-800 text-lg">Special Instructions</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                placeholder="Any special instructions, access codes, parking info, or specific requests..."
                className="min-h-[100px] border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg resize-none bg-gray-50/50 transition-all duration-200"
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Security Badge */}
          <div className="flex justify-center">
            <div className="flex items-center space-x-3 bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200 rounded-full px-6 py-3">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Your information is secure and encrypted</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit"
              className="w-full h-16 text-lg font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-700 hover:via-blue-700 hover:to-purple-700 text-white rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] disabled:transform-none"
              disabled={!isFormValid}
            >
              <span>Complete Booking - ${getTotalPrice()}</span>
              <ArrowRight className="h-5 w-5 ml-3" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
