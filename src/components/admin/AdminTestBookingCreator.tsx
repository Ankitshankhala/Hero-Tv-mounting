import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TestTube, Clock, DollarSign } from 'lucide-react';
import { useTestingMode } from '@/contexts/TestingModeContext';

export const AdminTestBookingCreator = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isTestingMode, activateTestingMode } = useTestingMode();

  const createTestBooking = async () => {
    setLoading(true);
    try {
      // Activate testing mode if not already active
      if (!isTestingMode) {
        activateTestingMode();
      }

      // First, get a service to use for the booking
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (servicesError || !services?.length) {
        throw new Error('No services available');
      }

      const service = services[0];

      // Create a test guest booking with $1 price
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const testBookingData = {
        service_id: service.id,
        scheduled_date: tomorrow.toISOString().split('T')[0],
        scheduled_start: '10:00:00',
        guest_customer_info: {
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '+1-555-123-4567',
          zipcode: '78216', // San Antonio ZIP
          city: 'San Antonio',
          address: '123 Test Street',
          houseNumber: '123',
          specialInstructions: 'Test booking created with $1 price for testing'
        },
        status: 'pending' as const,
        payment_status: 'pending' as const,
        requires_manual_payment: false
      };

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(testBookingData)
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create booking service with $1 price
      const { error: serviceError } = await supabase
        .from('booking_services')
        .insert({
          booking_id: booking.id,
          service_id: service.id,
          service_name: service.name,
          quantity: 1,
          base_price: 1, // $1 test price
          configuration: {}
        });

      if (serviceError) throw serviceError;

      toast({
        title: "✅ Test Booking Created",
        description: `Test booking created with $1 price. ID: ${booking.id.slice(0, 8)}...`,
      });

      // Refresh the page to see the new booking
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Error creating test booking:', error);
      toast({
        title: "❌ Error",
        description: `Failed to create test booking: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test Booking Creator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isTestingMode && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
            <div className="flex items-center space-x-2">
              <TestTube className="h-4 w-4 text-orange-600" />
              <span className="text-orange-800 font-semibold text-sm">Testing Mode Active</span>
              <div className="flex items-center text-orange-600 text-sm">
                <DollarSign className="h-3 w-3 mr-1" />
                $1 minimum
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <p className="text-slate-300 text-sm">
            Creates a test booking in San Antonio (78216) with $1 price for testing payment flows.
          </p>
          <ul className="text-slate-400 text-xs space-y-1">
            <li>• Guest booking (no auth required)</li>
            <li>• $1 base price for testing</li>
            <li>• San Antonio ZIP code (78216)</li>
            <li>• Tomorrow's date at 10:00 AM</li>
          </ul>
        </div>

        <Button 
          onClick={createTestBooking} 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Creating Test Booking...
            </>
          ) : (
            <>
              <TestTube className="h-4 w-4 mr-2" />
              Create $1 Test Booking
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};