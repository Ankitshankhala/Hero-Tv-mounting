// Simple diagnostic test component to verify booking creation works
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const TestBookingFix = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testGuestBookingCreation = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('🧪 Testing guest booking creation...');
      
      const testBookingData = {
        service_id: '1234', // Mock service ID
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_start: '10:00',
        location_notes: 'Test location',
        guest_customer_info: {
          email: 'test@example.com',
          name: 'Test Customer',
          phone: '555-123-4567',
          address: '123 Test St',
          city: 'Test City',
          zipcode: '12345'
        },
        services: [
          {
            id: '1234',
            name: 'Test Service',
            price: 99.99,
            quantity: 1,
            options: {}
          }
        ]
      };

      const { data, error } = await supabase.functions.invoke('create-guest-booking', {
        body: { 
          bookingData: testBookingData
        }
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      console.log('✅ Guest booking creation test result:', data);
      setResult({ success: true, data });
      
      toast({
        title: "Test Successful",
        description: "Guest booking creation is working properly!",
      });

    } catch (error) {
      console.error('❌ Guest booking creation test failed:', error);
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Test failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testRPCFunction = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('🧪 Testing find_existing_pending_booking RPC...');
      
      const { data, error } = await supabase.rpc('find_existing_pending_booking', {
        p_customer_id: null,
        p_guest_email: 'test@example.com',
        p_guest_phone: '555-123-4567',
        p_scheduled_date: new Date().toISOString().split('T')[0],
        p_scheduled_start: '10:00',
        p_grace_period_minutes: 30
      });

      if (error) {
        throw new Error(`RPC error: ${error.message}`);
      }

      console.log('✅ RPC function test result:', data);
      setResult({ success: true, data, type: 'rpc' });
      
      toast({
        title: "RPC Test Successful",
        description: "find_existing_pending_booking function is working!",
      });

    } catch (error) {
      console.error('❌ RPC function test failed:', error);
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'rpc'
      });
      
      toast({
        title: "RPC Test Failed",
        description: error instanceof Error ? error.message : "RPC test failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>🔧 Booking System Diagnostic</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button 
            onClick={testGuestBookingCreation}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test Guest Booking Creation'}
          </Button>
          
          <Button 
            onClick={testRPCFunction}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? 'Testing...' : 'Test RPC Function'}
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-muted">
            <h4 className="font-semibold mb-2">
              {result.success ? '✅ Test Result' : '❌ Test Failed'}
            </h4>
            <pre className="text-sm overflow-auto max-h-40">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};