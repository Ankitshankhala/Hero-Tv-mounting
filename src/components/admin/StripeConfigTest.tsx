
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, CreditCard } from 'lucide-react';
import { STRIPE_CONFIG, validateStripeConfig } from '@/lib/stripe-config';
import { supabase } from '@/integrations/supabase/client';

export const StripeConfigTest = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const runStripeConfigTest = async () => {
    setTesting(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    try {
      // Test 1: Configuration validation
      console.log('🔄 Testing Stripe configuration...');
      const configValidation = validateStripeConfig();
      results.tests.configuration = {
        name: 'Stripe Configuration',
        passed: configValidation.isValid,
        details: {
          publishableKey: STRIPE_CONFIG.publishableKey ? 'Present' : 'Missing',
          keyType: configValidation.keyType,
          errors: configValidation.errors
        }
      };

      // Test 2: Edge function connectivity
      console.log('🔄 Testing edge function connectivity...');
      try {
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            bookingId: 'test-booking-id',
            amount: 10.00,
            customerEmail: 'test@example.com',
            customerName: 'Test User'
          }
        });
        
        // For test booking, we expect a specific error response
        const isExpectedTestError = error && (
          error.message?.includes('Test booking ID provided') ||
          error.message?.includes('test-booking-id')
        );
        
        results.tests.edgeFunction = {
          name: 'Edge Function Connectivity',
          passed: isExpectedTestError || (!error && data?.success),
          details: {
            errorMessage: error?.message || 'Function accessible',
            status: isExpectedTestError ? 'Expected test error (good)' : 
                   (!error && data?.success) ? 'Function working' : 'Unexpected error',
            response: data ? 'Response received' : 'No response'
          }
        };
      } catch (err) {
        results.tests.edgeFunction = {
          name: 'Edge Function Connectivity',
          passed: false,
          details: {
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
            status: 'Connection failed'
          }
        };
      }

      // Test 3: Stripe.js loading
      console.log('🔄 Testing Stripe.js loading...');
      try {
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(STRIPE_CONFIG.publishableKey);
        results.tests.stripeJs = {
          name: 'Stripe.js Loading',
          passed: !!stripe,
          details: {
            loaded: !!stripe,
            status: stripe ? 'Successfully loaded' : 'Failed to load'
          }
        };
      } catch (err) {
        results.tests.stripeJs = {
          name: 'Stripe.js Loading',
          passed: false,
          details: {
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
            status: 'Import failed'
          }
        };
      }

      console.log('✅ Stripe configuration test completed:', results);
      setTestResults(results);

    } catch (error) {
      console.error('❌ Stripe configuration test failed:', error);
      results.error = error instanceof Error ? error.message : 'Unknown error';
      setTestResults(results);
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getStatusBadge = (passed: boolean) => {
    return (
      <Badge variant={passed ? "default" : "destructive"}>
        {passed ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-800 flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>Stripe Configuration Test</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-4">
          <Button 
            onClick={runStripeConfigTest}
            disabled={testing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {testing ? 'Testing...' : 'Run Stripe Tests'}
          </Button>
        </div>

        {testResults && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              Test completed at: {new Date(testResults.timestamp).toLocaleString()}
            </div>

            {testResults.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-red-700 font-medium">Test Suite Error</div>
                <div className="text-red-600 text-sm">{testResults.error}</div>
              </div>
            )}

            <div className="space-y-3">
              {Object.entries(testResults.tests).map(([key, test]: [string, any]) => (
                <div key={key} className="p-3 bg-white border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(test.passed)}
                      <span className="font-medium">{test.name}</span>
                    </div>
                    {getStatusBadge(test.passed)}
                  </div>
                  
                  <div className="text-sm text-slate-600 space-y-1">
                    {Object.entries(test.details).map(([detailKey, detailValue]) => (
                      <div key={detailKey} className="flex justify-between">
                        <span className="capitalize">{detailKey.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className={`font-mono text-xs ${
                          typeof detailValue === 'string' && detailValue.includes('error') && !detailValue.includes('Expected') 
                            ? 'text-red-600' 
                            : 'text-slate-700'
                        }`}>
                          {Array.isArray(detailValue) 
                            ? detailValue.join(', ') 
                            : String(detailValue)
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
