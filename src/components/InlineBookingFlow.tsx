
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { X, User, Mail, Phone, MapPin, Calendar as CalendarIcon, Clock, ArrowRight, Shield, Star, Sparkles, CheckCircle, Users, CreditCard, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { SecurePaymentForm } from '@/components/payment/SecurePaymentForm';
import { useToast } from '@/hooks/use-toast';

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface InlineBookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  selectedServices?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    options?: any;
  }>;
}

export const InlineBookingFlow = ({ isOpen, onClose, onSubmit, selectedServices = [] }: InlineBookingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const { toast } = useToast();

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

  const [services, setServices] = useState(selectedServices);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
  const [workerCount, setWorkerCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const serviceOptions: Record<string, ServiceOption[]> = {
    'tv-mounting': [
      { id: 'wall-type-drywall', name: 'Drywall Mount', price: 0 },
      { id: 'wall-type-brick', name: 'Brick/Concrete Mount', price: 25 },
      { id: 'cable-management', name: 'Cable Management', price: 35 },
      { id: 'sound-bar', name: 'Sound Bar Installation', price: 50 }
    ]
  };

  const handleServiceQuantityChange = (serviceId: string, change: number) => {
    setServices(prev => prev.map(service => {
      if (service.id === serviceId) {
        const newQuantity = Math.max(0, service.quantity + change);
        return { ...service, quantity: newQuantity };
      }
      return service;
    }).filter(service => service.quantity > 0));
  };

  const handleServiceOptionToggle = (serviceId: string, optionId: string, price: number) => {
    setServices(prev => prev.map(service => {
      if (service.id === serviceId) {
        const currentOptions = service.options || {};
        const newOptions = { ...currentOptions };
        
        if (newOptions[optionId]) {
          delete newOptions[optionId];
        } else {
          newOptions[optionId] = price;
        }
        
        return { ...service, options: newOptions };
      }
      return service;
    }));
  };

  const calculateServicePrice = (service: any) => {
    const basePrice = service.price * service.quantity;
    const optionsPrice = service.options ? 
      Object.values(service.options).reduce((sum: number, price: any) => sum + (Number(price) * service.quantity), 0) : 0;
    return basePrice + optionsPrice;
  };

  const getTotalPrice = () => {
    return services.reduce((total, service) => total + calculateServicePrice(service), 0);
  };

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

      const zipcodePrefix = zipcode.substring(0, 3);
      const relevantBookings = bookings?.filter(booking => {
        const workerZipcode = booking.worker_bookings?.[0]?.users?.zip_code;
        return workerZipcode && workerZipcode.substring(0, 3) === zipcodePrefix;
      }) || [];

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

  const createBooking = async () => {
    try {
      setIsProcessing(true);
      
      // Prepare customer information for location_notes
      const customerInfo = `Customer: ${formData.customerName}
Email: ${formData.customerEmail}
Phone: ${formData.customerPhone}
ZIP: ${formData.zipcode}
Address: ${formData.address}

Services: ${services.map(s => `${s.name} (${s.quantity}x)`).join(', ')}

Special Instructions: ${formData.specialInstructions}`;

      // Create booking in database
      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
          service_id: services[0]?.id,
          scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
          scheduled_start: formData.selectedTime,
          location_notes: customerInfo,
          duration_minutes: services.length * 60,
          requires_manual_payment: true
        })
        .select()
        .single();

      if (error) throw error;

      setBookingId(booking.id);
      setCurrentStep(4); // Move to payment step
      
    } catch (error: any) {
      console.error('Booking creation failed:', error);
      toast({
        title: "Booking Error",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSuccess = () => {
    setCurrentStep(5); // Move to success step
    toast({
      title: "Booking Confirmed",
      description: "Your booking has been confirmed and payment method saved.",
    });
  };

  const handlePaymentFailure = (error: string) => {
    toast({
      title: "Payment Setup Failed",
      description: error,
      variant: "destructive",
    });
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return services.length > 0;
      case 2:
        return formData.customerName && formData.customerEmail && formData.customerPhone && formData.zipcode && formData.address && formData.city && formData.region;
      case 3:
        return formData.selectedDate && formData.selectedTime;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep === 3) {
      createBooking();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden border border-gray-100">
        {/* Enhanced Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 text-white px-4 sm:px-8 py-4 sm:py-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <CalendarIcon className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">Book Your Service</h2>
              <p className="text-blue-100 text-xs sm:text-sm">
                {currentStep === 1 && "Configure your services"}
                {currentStep === 2 && "Enter your details"}
                {currentStep === 3 && "Choose date & time"}
                {currentStep === 4 && "Payment setup"}
                {currentStep === 5 && "Booking confirmed!"}
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-between items-center mt-4 sm:mt-6">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex flex-col items-center flex-1">
                <div className={cn(
                  "w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300",
                  step <= currentStep ? "bg-white text-blue-600" : "bg-white/20 text-white/60"
                )}>
                  {step <= currentStep ? <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" /> : step}
                </div>
                {step < 5 && (
                  <div className={cn(
                    "h-0.5 w-full mt-2 transition-all duration-300",
                    step < currentStep ? "bg-white" : "bg-white/20"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-140px)] p-4 sm:p-6">
          {/* Step 1: Service Configuration */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Configure Your Services</h3>
              
              {services.map((service) => (
                <Card key={service.id} className="border-2 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span>{service.name}</span>
                      <div className="flex items-center space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleServiceQuantityChange(service.id, -1)}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-bold text-lg min-w-[2rem] text-center">{service.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleServiceQuantityChange(service.id, 1)}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {serviceOptions[service.id] && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-gray-700">Add-on Options:</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {serviceOptions[service.id].map((option) => (
                            <div
                              key={option.id}
                              className={cn(
                                "p-3 border-2 rounded-lg cursor-pointer transition-all duration-200",
                                service.options?.[option.id] 
                                  ? "border-blue-500 bg-blue-50" 
                                  : "border-gray-200 hover:border-blue-300"
                              )}
                              onClick={() => handleServiceOptionToggle(service.id, option.id, option.price)}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium text-sm">{option.name}</div>
                                  {option.description && (
                                    <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-green-600">
                                    {option.price === 0 ? 'Free' : `+$${option.price}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-emerald-800">Service Total:</span>
                        <span className="font-bold text-emerald-700 text-lg">${calculateServicePrice(service)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-800">Total Amount:</span>
                    <span className="text-2xl font-bold text-emerald-700">${getTotalPrice()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Contact & Location Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Contact & Location Information</h3>
              
              {/* Contact Information */}
              <Card className="border-blue-200">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg border-b border-blue-100">
                  <CardTitle className="text-blue-800 flex items-center space-x-3">
                    <User className="h-5 w-5" />
                    <span>Your Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="customerName" className="text-sm font-semibold text-gray-700">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customerName"
                        value={formData.customerName}
                        onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                        placeholder="Enter your full name"
                        className="h-10 sm:h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerEmail" className="text-sm font-semibold text-gray-700">
                        Email Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        value={formData.customerEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                        placeholder="your.email@example.com"
                        className="h-10 sm:h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerPhone" className="text-sm font-semibold text-gray-700">
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customerPhone"
                        type="tel"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                        placeholder="(555) 123-4567"
                        className="h-10 sm:h-12"
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
                        className="[&_input]:h-10 sm:[&_input]:h-12"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Location */}
              <Card className="border-green-200">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg border-b border-green-100">
                  <CardTitle className="text-green-800 flex items-center space-x-3">
                    <MapPin className="h-5 w-5" />
                    <span>Service Location</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-semibold text-gray-700">
                      Complete Service Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="123 Main Street, Apartment 4B"
                      className="h-10 sm:h-12"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-semibold text-gray-700">
                        City <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Your city"
                        className="h-10 sm:h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="region" className="text-sm font-semibold text-gray-700">
                        Service Region <span className="text-red-500">*</span>
                      </Label>
                      <Select 
                        value={formData.region} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                      >
                        <SelectTrigger className="h-10 sm:h-12">
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

                  <div className="space-y-2">
                    <Label htmlFor="specialInstructions" className="text-sm font-semibold text-gray-700">
                      Special Instructions (Optional)
                    </Label>
                    <Textarea
                      id="specialInstructions"
                      value={formData.specialInstructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                      placeholder="Any special instructions, access codes, or requests..."
                      className="min-h-[80px] resize-none"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Schedule Service */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Schedule Your Service</h3>
              
              <Card className="border-purple-200">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-lg border-b border-purple-100">
                  <CardTitle className="text-purple-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CalendarIcon className="h-5 w-5" />
                      <span>Select Date & Time</span>
                    </div>
                    {workerCount > 0 && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                        <Users className="h-3 w-3 mr-1" />
                        {workerCount} workers available
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Calendar Section */}
                    <div className="space-y-4">
                      <Label className="text-sm font-semibold text-gray-700">
                        Select Date <span className="text-red-500">*</span>
                      </Label>
                      <div className="border-2 border-gray-200 rounded-lg p-3 bg-gray-50/30">
                        <Calendar
                          mode="single"
                          selected={formData.selectedDate}
                          onSelect={(date) => setFormData(prev => ({ ...prev, selectedDate: date }))}
                          disabled={(date) => date < new Date()}
                          className="w-full"
                          classNames={{
                            months: "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                            month: "space-y-4 w-full flex flex-col",
                            caption: "flex justify-center pt-1 relative items-center text-black",
                            caption_label: "text-sm font-medium",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex w-full",
                            head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] flex-1 text-center",
                            row: "flex w-full mt-2",
                            cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1",
                            day: "h-8 w-8 p-0 text-black font-normal aria-selected:opacity-100 mx-auto hover:bg-purple-100 rounded-md transition-colors",
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
                      <Label className="text-sm font-semibold text-gray-700">
                        Available Time Slots <span className="text-red-500">*</span>
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
                            <div className="text-xs text-gray-600 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center space-x-4 mb-2">
                                <div className="flex items-center space-x-1">
                                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  <span>Available</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                  <span>Booked</span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500">Times based on worker availability in ZIP: {formData.zipcode}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
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
                                      "h-10 text-sm font-medium transition-all duration-200 relative",
                                      isBlocked && "bg-red-100 border-red-300 text-red-600 cursor-not-allowed opacity-50",
                                      !isBlocked && !isSelected && "hover:bg-green-50 hover:border-green-300",
                                      isSelected && "bg-purple-600 text-white border-purple-600"
                                    )}
                                  >
                                    {time}
                                    {isBlocked && (
                                      <X className="h-3 w-3 absolute top-1 right-1" />
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
            </div>
          )}

          {/* Step 4: Payment Setup */}
          {currentStep === 4 && bookingId && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Payment Setup</h3>
              
              <SecurePaymentForm
                amount={getTotalPrice()}
                bookingId={bookingId}
                customerEmail={formData.customerEmail}
                customerName={formData.customerName}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentFailure={handlePaymentFailure}
                collectOnly={true}
              />
            </div>
          )}

          {/* Step 5: Success */}
          {currentStep === 5 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Booking Confirmed!</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Thank you for your booking. We'll contact you shortly to confirm the details and assign a technician.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="font-medium">
                      {formData.selectedDate && format(formData.selectedDate, 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time:</span>
                    <span className="font-medium">{formData.selectedTime}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Total:</span>
                    <span className="font-bold text-green-600">${getTotalPrice()}</span>
                  </div>
                </div>
              </div>
              <Button onClick={onClose} className="px-8">
                Close
              </Button>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        {currentStep < 5 && (
          <div className="border-t border-gray-200 p-4 sm:p-6 bg-gray-50 rounded-b-2xl">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {currentStep > 1 && currentStep < 4 && (
                <Button 
                  variant="outline" 
                  onClick={prevStep}
                  className="flex-1 h-12 text-sm sm:text-base"
                  disabled={isProcessing}
                >
                  Back
                </Button>
              )}
              
              {currentStep < 4 && (
                <Button 
                  onClick={nextStep}
                  className="flex-1 h-12 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  disabled={!isStepValid() || isProcessing}
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <>
                      {currentStep === 3 ? 'Create Booking' : 'Continue'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}

              {currentStep === 1 && (
                <div className="flex-1 text-center text-sm text-gray-500 py-3">
                  Step {currentStep} of 4
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
