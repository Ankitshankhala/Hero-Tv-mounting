import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSmsNotifications } from '@/hooks/useSmsNotifications';
import { CheckCircle, XCircle, Mail, Send, RefreshCw } from 'lucide-react';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'error' | 'checking';
  message: string;
  details?: string;
}

export const EmailHealthCheck = () => {
  const [healthResults, setHealthResults] = useState<HealthCheckResult[]>([]);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();
  const { resendCustomerEmail } = useSmsNotifications();

  const runHealthCheck = async () => {
    setChecking(true);
    const results: HealthCheckResult[] = [];

    // Check 1: RESEND_API_KEY availability
    try {
      results.push({ service: 'RESEND_API_KEY', status: 'checking', message: 'Checking API key...' });
      
      const { data, error } = await supabase.functions.invoke('get-secret', {
        body: { name: 'RESEND_API_KEY' }
      });

      if (error || !data?.value) {
        results[results.length - 1] = {
          service: 'RESEND_API_KEY',
          status: 'error',
          message: 'RESEND_API_KEY not configured',
          details: 'The Resend API key is missing from Supabase secrets'
        };
      } else {
        results[results.length - 1] = {
          service: 'RESEND_API_KEY',
          status: 'healthy',
          message: 'API key configured',
          details: `Key present (${data.value.substring(0, 8)}...)`
        };
      }
    } catch (error) {
      results[results.length - 1] = {
        service: 'RESEND_API_KEY',
        status: 'error',
        message: 'Failed to check API key',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check 2: Email function accessibility
    try {
      results.push({ service: 'Email Function', status: 'checking', message: 'Testing email function...' });
      
      const { error } = await supabase.functions.invoke('send-customer-booking-confirmation', {
        body: { bookingId: 'test-health-check' }
      });

      if (error) {
        if (error.message.includes('Booking not found')) {
          results[results.length - 1] = {
            service: 'Email Function',
            status: 'healthy',
            message: 'Function accessible',
            details: 'Function responded correctly to test request'
          };
        } else {
          results[results.length - 1] = {
            service: 'Email Function',
            status: 'error',
            message: 'Function error',
            details: error.message
          };
        }
      } else {
        results[results.length - 1] = {
          service: 'Email Function',
          status: 'healthy',
          message: 'Function accessible',
          details: 'Function responded successfully'
        };
      }
    } catch (error) {
      results[results.length - 1] = {
        service: 'Email Function',
        status: 'error',
        message: 'Function unreachable',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check 3: Recent email logs
    try {
      results.push({ service: 'Email Logs', status: 'checking', message: 'Checking recent activity...' });
      
      const { data: recentLogs, error } = await supabase
        .from('email_logs')
        .select('status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        results[results.length - 1] = {
          service: 'Email Logs',
          status: 'error',
          message: 'Cannot access logs',
          details: error.message
        };
      } else {
        const successCount = recentLogs?.filter(log => log.status === 'sent').length || 0;
        const totalCount = recentLogs?.length || 0;
        
        results[results.length - 1] = {
          service: 'Email Logs',
          status: totalCount > 0 ? 'healthy' : 'error',
          message: totalCount > 0 ? 'Recent activity found' : 'No recent email activity',
          details: `${successCount}/${totalCount} emails sent successfully in last 10 attempts`
        };
      }
    } catch (error) {
      results[results.length - 1] = {
        service: 'Email Logs',
        status: 'error',
        message: 'Log check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    setHealthResults(results);
    setChecking(false);

    const errorCount = results.filter(r => r.status === 'error').length;
    if (errorCount > 0) {
      toast({
        title: "Email System Issues Found",
        description: `${errorCount} service(s) need attention`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email System Healthy",
        description: "All email services are working correctly",
      });
    }
  };

  const testEmailWithRecentBooking = async () => {
    try {
      const { data: recentBooking, error } = await supabase
        .from('bookings')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !recentBooking) {
        toast({
          title: "No Bookings Found",
          description: "No recent bookings available for email testing",
          variant: "destructive",
        });
        return;
      }

      await resendCustomerEmail(recentBooking.id);
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to test email with recent booking",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: HealthCheckResult['status']) => {
    const variants = {
      healthy: 'default' as const,
      error: 'destructive' as const,
      checking: 'secondary' as const,
    };
    
    return (
      <Badge variant={variants[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email System Health Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={runHealthCheck} disabled={checking}>
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Run Health Check
          </Button>
          <Button onClick={testEmailWithRecentBooking} variant="outline">
            <Send className="h-4 w-4 mr-2" />
            Test with Recent Booking
          </Button>
        </div>

        {healthResults.length > 0 && (
          <div className="space-y-3">
            {healthResults.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.service}</span>
                    {getStatusBadge(result.status)}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                
                {result.details && (
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                    {result.details}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {healthResults.length === 0 && !checking && (
          <div className="text-center py-8 text-gray-500">
            Run a health check to see email system status
          </div>
        )}
      </CardContent>
    </Card>
  );
};