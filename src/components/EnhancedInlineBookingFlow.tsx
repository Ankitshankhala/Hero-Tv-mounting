
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { Calendar } from '@/components/ui/calendar';
import { X, User, Mail, Phone, MapPin, Calendar as CalendarIcon, Clock, ArrowRight, Shield, Star, CheckCircle, Users, CreditCard, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { SecurePaymentForm } from '@/components/payment/SecurePaymentForm';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: Record<string, any>;
}

interface EnhancedInlineBookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
  selectedServices?: ServiceItem[];
}

export const EnhancedInlineBookingFlow = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedServices = [] 
}: EnhancedInlineBookingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<ServiceItem[]>(selectedServices);
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
  const [bookingId, setBookingId] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const steps = [
    { number: 1, title: 'Services', description: 'Configure services' },
    { number: 2, title: 'Details', description: 'Contact & location' },
    { number: 3, title: 'Schedule', description: 'Date & time' },
    { number: 4, title: 'Payment', description: 'Secure payment' }
  ];

  // Update services when props change
  useEffect(() => {
    setServices(selectedServices);
  }, [selectedServices]);

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

  const updateServiceQuantity = (serviceId: string, change: number) => {
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, quantity: Math.max(1, service.quantity + change) }
        : service
    ));
  };

  const removeService = (serviceId: string) => {
    setServices(prev => prev.filter(service => service.id !== serviceId));
  };

  const getTotalPrice = () => {
    return services.reduce((total, service) => total + (service.price * service.quantity), 0);
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

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBookingSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to complete your booking.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Get the first service ID as the primary service for the booking
      const primaryServiceId = services.length > 0 ? services[0].id : null;
      
      if (!primaryServiceId) {
        throw new Error('No services selected');
      }

      const bookingData = {
        customer_id: user.id,
        service_id: primaryServiceId, // Add the required service_id field
        scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
        scheduled_start: formData.selectedTime,
        location_notes: `${formData.address}, ${formData.city}\nContact: ${formData.customerName}\nPhone: ${formData.customerPhone}\nEmail: ${formData.customerEmail}\nZIP: ${formData.zipcode}\nSpecial Instructions: ${formData.specialInstructions}`,
        status: 'pending',
        requires_manual_payment: true
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

      if (error) throw error;

      setBookingId(data.id);
      setCurrentStep(4);
      
      toast({
        title: "Booking Created",
        description: "Your booking has been created. Please complete payment.",
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowSuccess(true);
    toast({
      title: "Payment Successful",
      description: "Your booking has been confirmed!",
    });
  };

  const handlePaymentFailure = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };

  const isStep1Valid = services.length > 0;
  const isStep2Valid = formData.customerName && formData.customerEmail && formData.customerPhone && formData.address && formData.zipcode;
  const isStep3Valid = formData.selectedDate && formData.selectedTime;

  if (!isOpen) return null;

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for your booking. We'll contact you shortly to confirm the details and assign a technician.
          </p>
          <Button onClick={onClose} className="w-full">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto border border-gray-100">
        {/* Enhanced Header with Progress */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 text-white px-4 sm:px-8 py-4 sm:py-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-3 mb-4 sm:mb-0">
              <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <CalendarIcon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-1">Book Your Service</h2>
                <p className="text-blue-100 text-xs sm:text-sm">Step {currentStep} of {steps.length}</p>
              </div>
            </div>
            
            {/* Progress Steps - Mobile Friendly */}
            <div className="flex space-x-2 overflow-x-auto pb-2 sm:pb-0">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                    currentStep >= step.number 
                      ? "bg-white text-indigo-600" 
                      : "bg-white/20 text-white"
                  )}>
                    {step.number}
                  </div>
                  <div className="hidden sm:block ml-2 min-w-0">
                    <div className="text-xs font-medium">{step.title}</div>
                    <div className="text-xs text-blue-200">{step.description}</div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-4 sm:w-8 h-0.5 bg-white/20 mx-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Step 1: Service Configuration */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Configure Your Services</h3>
                <p className="text-gray-600">Customize quantities and options for your selected services</p>
              </div>

              <div className="space-y-4">
                {services.map((service) => (
                  <Card key={service.id} className="border-2 border-gray-200 hover:border-blue-300 transition-colors">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-gray-900">{service.name}</h4>
                          <p className="text-gray-600">${service.price} each</p>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateServiceQuantity(service.id, -1)}
                              disabled={service.quantity <= 1}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">{service.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateServiceQuantity(service.id, 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-bold text-lg text-green-600">
                              ${service.price * service.quantity}
                            </div>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeService(service.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {services.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>No services selected. Please select services from the homepage.</p>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>Total:</span>
                  <span className="text-green-600">${getTotalPrice()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact & Location */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Contact & Location Details</h3>
                <p className="text-gray-600">We need your information to schedule the service</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3">
                  <Label htmlFor="customerName" className="text-base font-medium flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span>Full Name *</span>
                  </Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="h-12"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="customerEmail" className="text-base font-medium flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span>Email Address *</span>
                  </Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    placeholder="your.email@example.com"
                    className="h-12"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="customerPhone" className="text-base font-medium flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>Phone Number *</span>
                  </Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="h-12"
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
                    className="[&_input]:h-12"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="address" className="text-base font-medium flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span>Service Address *</span>
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street, Apartment 4B"
                  className="h-12"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3">
                  <Label htmlFor="city" className="text-base font-medium">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="h-12"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="region" className="text-base font-medium">Service Region</Label>
                  <Select 
                    value={formData.region} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                  >
                    <SelectTrigger className="h-12">
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

              <div className="space-y-3">
                <Label htmlFor="specialInstructions" className="text-base font-medium">Special Instructions</Label>
                <Textarea
                  id="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Any special instructions, access codes, parking info..."
                  className="min-h-[100px]"
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Schedule Your Service</h3>
                <p className="text-gray-600">Choose your preferred date and time</p>
                {workerCount > 0 && (
                  <div className="inline-flex items-center space-x-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full mt-2">
                    <Users className="h-4 w-4" />
                    <span>{workerCount} workers available in your area</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-base font-medium flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4 text-purple-600" />
                    <span>Select Date *</span>
                  </Label>
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <Calendar
                      mode="single"
                      selected={formData.selectedDate}
                      onSelect={(date) => setFormData(prev => ({ ...prev, selectedDate: date }))}
                      disabled={(date) => date < new Date()}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-medium flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-purple-600" />
                    <span>Available Time Slots *</span>
                  </Label>
                  
                  <div className="border-2 border-gray-200 rounded-lg p-4">
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
                        <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>Available</span>
                            <div className="w-3 h-3 bg-red-500 rounded-full ml-4"></div>
                            <span>Booked</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Times based on worker availability (ZIP: {formData.zipcode})
                          </p>
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
                                  "h-12 text-sm font-medium transition-all duration-200 relative",
                                  isBlocked && "bg-red-50 text-red-600 border-red-200 cursor-not-allowed hover:bg-red-50",
                                  isSelected && "bg-purple-600 text-white border-purple-600 shadow-md",
                                  !isBlocked && !isSelected && "hover:bg-purple-50 hover:border-purple-300"
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
          )}

          {/* Step 4: Payment */}
          {currentStep === 4 && bookingId && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Secure Payment</h3>
                <p className="text-gray-600">Complete your booking with secure payment</p>
              </div>

              <SecurePaymentForm
                amount={getTotalPrice()}
                bookingId={bookingId}
                customerId={user?.id}
                customerEmail={formData.customerEmail || user?.email}
                customerName={formData.customerName}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentFailure={handlePaymentFailure}
                collectOnly={true}
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-600">Secure & encrypted</span>
            </div>

            <div className="flex space-x-3 w-full sm:w-auto">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  className="flex-1 sm:flex-none"
                >
                  Back
                </Button>
              )}
              
              {currentStep < 3 && (
                <Button
                  onClick={handleNextStep}
                  disabled={
                    (currentStep === 1 && !isStep1Valid) ||
                    (currentStep === 2 && !isStep2Valid)
                  }
                  className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  Next Step
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              {currentStep === 3 && (
                <Button
                  onClick={handleBookingSubmit}
                  disabled={!isStep3Valid || loading}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {loading ? 'Creating...' : 'Create Booking'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
