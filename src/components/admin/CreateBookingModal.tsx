import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';
import { useBookingOperations } from '@/hooks/useBookingOperations';
import { createEnhancedBooking, EnhancedBookingData } from '@/utils/enhancedBookingLogic';
import { TvMountingConfigModal } from './TvMountingConfigModal';

interface CreateBookingModalProps {
  onClose: () => void;
  onBookingCreated?: () => void;
}

interface Worker {
  id: string;
  name: string;
  email: string;
}

interface TvMountingConfig {
  numberOfTvs: number;
  tvConfigurations: Array<{
    id: string;
    over65: boolean;
    frameMount: boolean;
    wallType: string;
    soundbar: boolean;
  }>;
  totalPrice: number;
  services: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export const CreateBookingModal = ({ onClose, onBookingCreated }: CreateBookingModalProps) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    service: '',
    date: '',
    time: '',
    address: '',
    region: '',
    worker: '',
    specialInstructions: '',
    zipcode: '',
    city: ''
  });
  
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTvConfig, setShowTvConfig] = useState(false);
  const [tvMountingConfig, setTvMountingConfig] = useState<TvMountingConfig | null>(null);
  const { toast } = useToast();
  const { services, loading: servicesLoading } = usePublicServicesData();
  const { createBooking } = useBookingOperations();

  // Find TV mounting service
  const tvMountingService = services.find(s => s.name === 'TV Mounting');
  const isSelectedServiceTvMounting = formData.service === tvMountingService?.id;

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'worker')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching workers:', error);
        throw error;
      }

      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast({
        title: "Error",
        description: "Failed to load workers",
        variant: "destructive",
      });
    }
  };

  const handleServiceChange = (serviceId: string) => {
    setFormData({...formData, service: serviceId});
    // Reset TV mounting config if switching away from TV mounting
    if (serviceId !== tvMountingService?.id) {
      setTvMountingConfig(null);
    }
  };

  const handleTvConfigComplete = (config: TvMountingConfig) => {
    setTvMountingConfig(config);
    setShowTvConfig(false);
  };

  const getServicePrice = () => {
    if (isSelectedServiceTvMounting && tvMountingConfig) {
      return tvMountingConfig.totalPrice;
    }
    const selectedService = services.find(s => s.id === formData.service);
    return selectedService?.base_price || 0;
  };

  const getServiceDisplayName = () => {
    if (isSelectedServiceTvMounting && tvMountingConfig) {
      return `TV Mounting (${tvMountingConfig.numberOfTvs} TV${tvMountingConfig.numberOfTvs > 1 ? 's' : ''}) + Add-ons`;
    }
    const selectedService = services.find(s => s.id === formData.service);
    return selectedService?.name || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.service || !formData.date || !formData.time || !formData.customerName || !formData.customerEmail) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (isSelectedServiceTvMounting && !tvMountingConfig) {
      toast({
        title: "Error",
        description: "Please configure TV mounting options",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Creating guest booking with data:', formData);

      // Create guest customer info (no user account needed)
      const guestCustomerInfo = {
        name: formData.customerName,
        email: formData.customerEmail,
        phone: formData.customerPhone,
        zipcode: formData.zipcode || '',
        city: formData.city || '',
        address: formData.address || ''
      };

      console.log('Guest customer info:', guestCustomerInfo);

      // Build location notes with TV mounting config if applicable
      let locationNotes = `${formData.address}\n\nRegion: ${formData.region}`;
      
      if (formData.specialInstructions) {
        locationNotes += `\n\nSpecial Instructions: ${formData.specialInstructions}`;
      }

      if (isSelectedServiceTvMounting && tvMountingConfig) {
        locationNotes += `\n\nTV Mounting Configuration:\n`;
        locationNotes += `- Number of TVs: ${tvMountingConfig.numberOfTvs}\n`;
        locationNotes += `- Total Price: $${tvMountingConfig.totalPrice}\n`;
        locationNotes += `- Services: ${tvMountingConfig.services.map(s => s.name).join(', ')}`;
      }

      // If specific worker selected, use regular booking creation
      if (formData.worker && formData.worker !== 'auto') {
        const bookingData = {
          customer_id: null, // Always null for guest bookings
          guest_customer_info: guestCustomerInfo,
          service_id: formData.service,
          scheduled_date: formData.date,
          scheduled_start: formData.time,
          location_notes: locationNotes,
          status: 'confirmed' as const,
          payment_status: 'pending' as const,
          requires_manual_payment: true,
          worker_id: formData.worker
        };

        console.log('Creating booking with specific worker:', bookingData);
        const booking = await createBooking(bookingData);
        console.log('Booking created:', booking);

        toast({
          title: "Success",
          description: "Booking created and assigned to worker successfully",
        });
      } else {
        // Use enhanced booking logic with auto-assignment
        const enhancedBookingData: EnhancedBookingData = {
          customer_id: null, // Always null for guest bookings
          guest_customer_info: guestCustomerInfo,
          service_id: formData.service,
          scheduled_date: formData.date,
          scheduled_start: formData.time,
          location_notes: locationNotes,
          customer_zipcode: formData.region // Using region as zipcode for admin bookings
        };

        console.log('Creating booking with auto-assignment:', enhancedBookingData);
        const result = await createEnhancedBooking(enhancedBookingData);
        
        if (result.status === 'error') {
          throw new Error(result.message);
        }

        console.log('Enhanced booking result:', result);

        // Show appropriate message based on assignment status
        let toastMessage = result.message;
        if (result.worker_assigned) {
          toastMessage = "Booking created and worker automatically assigned!";
        } else if (result.notifications_sent && result.notifications_sent > 0) {
          toastMessage = `Booking created! Coverage requests sent to ${result.notifications_sent} workers.`;
        }

        toast({
          title: result.status === 'confirmed' ? "Booking Confirmed" : "Booking Created",
          description: toastMessage,
        });
      }

      if (onBookingCreated) {
        onBookingCreated();
      }
      onClose();
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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Create New Booking</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerEmail">Customer Email *</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">Customer Phone *</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="service">Service *</Label>
                <Select value={formData.service} onValueChange={handleServiceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicesLoading ? (
                      <SelectItem value="loading" disabled>Loading services...</SelectItem>
                    ) : (
                      services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - ${service.base_price}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* TV Mounting Configuration */}
            {isSelectedServiceTvMounting && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-blue-800 font-semibold">TV Mounting Configuration</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTvConfig(true)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
                {tvMountingConfig ? (
                  <div className="text-sm text-blue-700">
                    <p><strong>Service:</strong> {getServiceDisplayName()}</p>
                    <p><strong>Total Price:</strong> ${getServicePrice()}</p>
                    <p><strong>Configuration:</strong> {tvMountingConfig.services.map(s => s.name).join(', ')}</p>
                  </div>
                ) : (
                  <p className="text-sm text-blue-600">Click "Configure" to set up TV mounting options</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="time">Time *</Label>
                <Select value={formData.time} onValueChange={(value) => setFormData({...formData, time: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00">9:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="11:00">11:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="13:00">1:00 PM</SelectItem>
                    <SelectItem value="14:00">2:00 PM</SelectItem>
                    <SelectItem value="15:00">3:00 PM</SelectItem>
                    <SelectItem value="16:00">4:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="address">Service Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full service address"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="region">Region</Label>
                <Select value={formData.region} onValueChange={(value) => setFormData({...formData, region: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="downtown">Downtown</SelectItem>
                    <SelectItem value="north-side">North Side</SelectItem>
                    <SelectItem value="west-end">West End</SelectItem>
                    <SelectItem value="east-side">East Side</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="worker">Assign Worker</Label>
                <Select value={formData.worker} onValueChange={(value) => setFormData({...formData, worker: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select worker assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-assign</SelectItem>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.name} ({worker.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={formData.specialInstructions}
                onChange={(e) => setFormData({...formData, specialInstructions: e.target.value})}
                placeholder="Any special instructions for the technician..."
              />
            </div>

            <div className="flex space-x-4 pt-4">
              <Button 
                type="submit" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loading || servicesLoading}
              >
                {loading ? 'Creating...' : 'Create Booking'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* TV Mounting Configuration Modal */}
      {showTvConfig && tvMountingService && (
        <TvMountingConfigModal
          open={showTvConfig}
          onClose={() => setShowTvConfig(false)}
          onConfigComplete={handleTvConfigComplete}
          services={services}
          initialConfig={tvMountingConfig}
        />
      )}
    </>
  );
};
