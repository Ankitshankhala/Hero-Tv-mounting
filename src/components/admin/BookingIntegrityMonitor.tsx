import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrityIssue {
  booking_id: string;
  status: string;
  payment_status: string;
  payment_intent_id: string | null;
  service_id: string | null;
  created_at: string;
  service_count: number;
  issue_type: string;
}

export function BookingIntegrityMonitor() {
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_bookings_integrity_issues')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (error) {
      console.error('Error fetching integrity issues:', error);
      toast.error('Failed to fetch integrity issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleValidate = async (bookingId: string) => {
    setValidating(bookingId);
    try {
      const { data, error } = await supabase.functions.invoke('validate-booking-integrity', {
        body: { bookingId, autoFix: true }
      });

      if (error) throw error;

      if (data.isValid) {
        toast.success('Booking validation passed');
      } else if (data.warnings.some((w: string) => w.includes('Auto-fixed'))) {
        toast.success('Booking auto-fixed successfully');
        fetchIssues();
      } else {
        toast.error(`Validation failed: ${data.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Error validating booking:', error);
      toast.error('Failed to validate booking');
    } finally {
      setValidating(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Integrity Monitor</CardTitle>
          <CardDescription>Loading integrity issues...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Booking Integrity Monitor</CardTitle>
            <CardDescription>
              Monitors bookings with data integrity issues
            </CardDescription>
          </div>
          <Button onClick={fetchIssues} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No integrity issues found. All bookings have valid data.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Found {issues.length} booking(s) with integrity issues
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              {issues.map((issue) => (
                <div
                  key={issue.booking_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      Booking: {issue.booking_id.slice(0, 8)}...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Issue: {issue.issue_type.replace(/_/g, ' ')} | 
                      Status: {issue.status} | 
                      Services: {issue.service_count}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleValidate(issue.booking_id)}
                    disabled={validating === issue.booking_id}
                    size="sm"
                    variant="outline"
                  >
                    {validating === issue.booking_id ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      'Auto Fix'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
