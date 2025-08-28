import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Play, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
}

export const BookingSmokeTest = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const updateResult = (step: string, status: TestResult['status'], message?: string, data?: any) => {
    setResults(prev => {
      const existing = prev.find(r => r.step === step);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.data = data;
        return [...prev];
      }
      return [...prev, { step, status, message, data }];
    });
  };

  const runSmokeTest = async () => {
    setIsRunning(true);
    setResults([]);

    const steps = [
      'Service Selection',
      'Guest Booking Creation',
      'Payment Authorization', 
      'Status Verification',
      'Cleanup'
    ];

    // Initialize all steps as pending
    steps.forEach(step => updateResult(step, 'pending'));

    try {
      // Step 1: Service Selection
      updateResult('Service Selection', 'running');
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, name, base_price')
        .eq('is_active', true)
        .limit(1);

      if (servicesError || !services?.[0]) {
        throw new Error('No active services found');
      }

      const service = services[0];
      updateResult('Service Selection', 'success', `Selected: ${service.name}`);

      // Step 2: Create Guest Booking
      updateResult('Guest Booking Creation', 'running');
      const testBooking = {
        service_id: service.id,
        scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week from now
        scheduled_start: '10:00:00',
        guest_customer_info: {
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '+1234567890',
          zipcode: '75001',
          address: '123 Test St',
          city: 'Dallas'
        }
      };

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(testBooking)
        .select()
        .single();

      if (bookingError) {
        throw new Error(`Booking creation failed: ${bookingError.message}`);
      }

      updateResult('Guest Booking Creation', 'success', `Created booking: ${booking.id.substring(0, 8)}...`);

      // Step 3: Test Payment Authorization
      updateResult('Payment Authorization', 'running');
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('test-e2e-booking-capture', {
        body: { booking_id: booking.id }
      });

      if (paymentError) {
        throw new Error(`Payment test failed: ${paymentError.message}`);
      }

      if (!paymentData?.success) {
        throw new Error(`Payment test unsuccessful: ${paymentData?.error || 'Unknown error'}`);
      }

      updateResult('Payment Authorization', 'success', 'Test payment authorized successfully');

      // Step 4: Verify Status Transitions
      updateResult('Status Verification', 'running');
      const { data: updatedBooking, error: verifyError } = await supabase
        .from('bookings')
        .select('status, payment_status')
        .eq('id', booking.id)
        .single();

      if (verifyError) {
        throw new Error(`Status verification failed: ${verifyError.message}`);
      }

      const expectedStatuses = ['payment_authorized', 'confirmed', 'completed'];
      if (!expectedStatuses.includes(updatedBooking.status)) {
        throw new Error(`Unexpected booking status: ${updatedBooking.status}`);
      }

      updateResult('Status Verification', 'success', `Status: ${updatedBooking.status}, Payment: ${updatedBooking.payment_status}`);

      // Step 5: Cleanup
      updateResult('Cleanup', 'running');
      const { error: cleanupError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);

      if (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
        updateResult('Cleanup', 'error', 'Manual cleanup may be required');
      } else {
        updateResult('Cleanup', 'success', 'Test data cleaned up');
      }

      toast({
        title: "Smoke Test Completed",
        description: "All booking workflow tests passed successfully",
      });

    } catch (error) {
      console.error('Smoke test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Mark current running step as error
      const runningStep = results.find(r => r.status === 'running');
      if (runningStep) {
        updateResult(runningStep.step, 'error', errorMessage);
      }

      toast({
        title: "Smoke Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-slate-400" />;
      case 'running':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'text-slate-400';
      case 'running':
        return 'text-blue-400';
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
    }
  };

  const overallStatus = results.length === 0 ? 'idle' :
                       results.some(r => r.status === 'error') ? 'error' :
                       results.some(r => r.status === 'running') ? 'running' :
                       results.every(r => r.status === 'success') ? 'success' : 'partial';

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          Booking System Smoke Test
          {overallStatus !== 'idle' && (
            <Badge variant={overallStatus === 'success' ? 'default' : overallStatus === 'error' ? 'destructive' : 'secondary'}>
              {overallStatus === 'running' && 'Running'}
              {overallStatus === 'success' && 'Passed'}
              {overallStatus === 'error' && 'Failed'}
              {overallStatus === 'partial' && 'Partial'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-slate-400">
          End-to-end test of the complete booking workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {results.map((result, index) => (
            <div key={result.step} className="flex items-center gap-3 p-2 rounded border border-slate-700/50">
              {getStatusIcon(result.status)}
              <div className="flex-1">
                <div className={`text-sm font-medium ${getStatusColor(result.status)}`}>
                  {result.step}
                </div>
                {result.message && (
                  <div className="text-xs text-slate-500">{result.message}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && (
          <Alert className="border-blue-500/50 bg-blue-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-blue-400">
              This test will create a guest booking, authorize payment, and verify status transitions.
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={runSmokeTest}
          disabled={isRunning}
          className="w-full"
          size="sm"
        >
          <Play className="h-4 w-4 mr-2" />
          {isRunning ? 'Running Tests...' : 'Run Smoke Test'}
        </Button>
      </CardContent>
    </Card>
  );
};