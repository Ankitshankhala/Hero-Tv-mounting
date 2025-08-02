import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useEmailNotifications } from '@/hooks/useEmailNotifications';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Send } from 'lucide-react';

interface EmailTestResult {
  type: string;
  success: boolean;
  message: string;
  timestamp: string;
}

export const EmailTestButton = () => {
  const [testBookingId, setTestBookingId] = useState('2a1ad54c-856f-4f99-b81b-0af580283ac5');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<EmailTestResult[]>([]);
  const { toast } = useToast();
  const { sendCustomerConfirmationEmail, sendWorkerAssignmentEmail, sendFinalInvoiceEmail } = useEmailNotifications();

  const addTestResult = (result: EmailTestResult) => {
    setTestResults(prev => [result, ...prev.slice(0, 9)]); // Keep only last 10 results
  };

  const testCustomerEmail = async () => {
    if (!testBookingId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a booking ID',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    try {
      const success = await sendCustomerConfirmationEmail(testBookingId.trim());
      
      addTestResult({
        type: 'Customer Confirmation',
        success,
        message: success ? 'Email sent successfully' : 'Email sending failed',
        timestamp: new Date().toLocaleTimeString()
      });

      toast({
        title: success ? 'Success' : 'Failed',
        description: success ? 'Customer confirmation email sent' : 'Failed to send customer email',
        variant: success ? 'default' : 'destructive'
      });
    } catch (error: any) {
      addTestResult({
        type: 'Customer Confirmation',
        success: false,
        message: error.message || 'Unknown error',
        timestamp: new Date().toLocaleTimeString()
      });

      toast({
        title: 'Error',
        description: error.message || 'Failed to send email',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const testWorkerEmail = async () => {
    if (!testBookingId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a booking ID',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    try {
      const success = await sendWorkerAssignmentEmail(testBookingId.trim());
      
      addTestResult({
        type: 'Worker Assignment',
        success,
        message: success ? 'Email sent successfully' : 'Email sending failed',
        timestamp: new Date().toLocaleTimeString()
      });

      toast({
        title: success ? 'Success' : 'Failed',
        description: success ? 'Worker assignment email sent' : 'Failed to send worker email',
        variant: success ? 'default' : 'destructive'
      });
    } catch (error: any) {
      addTestResult({
        type: 'Worker Assignment',
        success: false,
        message: error.message || 'Unknown error',
        timestamp: new Date().toLocaleTimeString()
      });

      toast({
        title: 'Error',
        description: error.message || 'Failed to send email',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Quick Email Test
        </CardTitle>
        <CardDescription>
          Test email functions with a specific booking ID
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter booking ID"
            value={testBookingId}
            onChange={(e) => setTestBookingId(e.target.value)}
            className="flex-1"
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={testCustomerEmail} 
            disabled={testing}
            size="sm"
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Test Customer Email
          </Button>
          
          <Button 
            onClick={testWorkerEmail} 
            disabled={testing}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Test Worker Email
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Test Results:</h4>
            {testResults.slice(0, 3).map((result, index) => (
              <Alert key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={result.success ? 'default' : 'destructive'}>
                      {result.success ? 'PASS' : 'FAIL'}
                    </Badge>
                    <span className="text-sm font-medium">{result.type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                </div>
                <AlertDescription className="mt-1">
                  {result.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};