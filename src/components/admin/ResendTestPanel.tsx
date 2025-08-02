import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
}

export const ResendTestPanel = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const runTest = async (testName: string, functionName: string, body: any = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      
      if (error) {
        return {
          test: testName,
          success: false,
          message: error.message,
          details: error
        };
      }
      
      return {
        test: testName,
        success: data?.success !== false,
        message: data?.message || 'Test completed',
        details: data
      };
    } catch (error: any) {
      return {
        test: testName,
        success: false,
        message: error.message,
        details: error
      };
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setResults([]);
    
    try {
      // Test 1: Check if RESEND_API_KEY exists
      const secretTest = await runTest(
        'Check RESEND_API_KEY Secret',
        'get-secret',
        { name: 'RESEND_API_KEY' }
      );
      
      // Test 2: Debug Resend configuration
      const debugTest = await runTest(
        'Debug Resend Configuration',
        'debug-resend'
      );
      
      // Test 3: Test Resend API connection
      const resendTest = await runTest(
        'Test Resend API Connection',
        'test-resend-config'
      );
      
      // Test 4: Simple email test
      const emailTest = await runTest(
        'Send Test Email',
        'simple-email-test'
      );
      
      // Test 5: Customer email function test
      const customerEmailTest = await runTest(
        'Test Customer Email Function',
        'send-customer-booking-confirmation-email',
        { bookingId: '1364c530-90bc-4673-a249-bcd24a9edfd7' }
      );

      const allResults = [secretTest, debugTest, resendTest, emailTest, customerEmailTest];
      setResults(allResults);
      
      const failedTests = allResults.filter(r => !r.success);
      if (failedTests.length === 0) {
        toast({
          title: 'All Tests Passed',
          description: 'RESEND configuration is working correctly',
        });
      } else {
        toast({
          title: `${failedTests.length} Test(s) Failed`,
          description: 'Check the results below for details',
          variant: 'destructive'
        });
      }
      
    } catch (error: any) {
      toast({
        title: 'Test Suite Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    if (success) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusBadge = (success: boolean) => {
    if (success) return <Badge variant="default" className="bg-green-100 text-green-800">PASS</Badge>;
    return <Badge variant="destructive">FAIL</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          RESEND Configuration Test
        </CardTitle>
        <CardDescription>
          Test email configuration and identify issues with RESEND API setup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runAllTests} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            'Run All RESEND Tests'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Test Results:</h3>
            {results.map((result, index) => (
              <Alert key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.success)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.test}</span>
                        {getStatusBadge(result.success)}
                      </div>
                      <AlertDescription className="mt-1">
                        {result.message}
                      </AlertDescription>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-muted-foreground">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Common Issues:</strong>
            <ul className="mt-2 list-disc list-inside text-sm space-y-1">
              <li>RESEND_API_KEY not set in Supabase secrets</li>
              <li>Invalid or expired API key</li>
              <li>Domain not verified in Resend dashboard</li>
              <li>API key lacks email sending permissions</li>
              <li>Edge functions not properly deployed</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};