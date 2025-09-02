import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, MapPin, Search, CheckCircle, XCircle } from 'lucide-react';
import { useWorkerServiceAreas } from '@/hooks/useWorkerServiceAreas';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const CoverageStatusCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { serviceAreas, getActiveZipcodes, getActiveServiceAreas, fetchServiceAreas } = useWorkerServiceAreas(user?.id);
  const [testZip, setTestZip] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<'covered' | 'not-covered' | null>(null);

  React.useEffect(() => {
    if (user?.id) {
      fetchServiceAreas();
    }
  }, [user?.id, fetchServiceAreas]);

  const activeAreas = getActiveServiceAreas();
  const activeZipcodes = getActiveZipcodes();
  const totalZips = activeZipcodes.length;
  const totalAreas = activeAreas.length;

  const testZipCoverage = async () => {
    if (!testZip || testZip.length !== 5) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit ZIP code",
        variant: "destructive"
      });
      return;
    }

    setTestLoading(true);
    try {
      // Test if this worker would be available for this ZIP
      const { data, error } = await supabase.rpc('get_available_time_slots', {
        p_zipcode: testZip,
        p_date: new Date().toISOString().split('T')[0], // Today's date
        p_service_duration_minutes: 60
      });

      if (error) throw error;

      // Check if this worker appears in any of the results
      const workerAvailable = data?.some((slot: any) => 
        slot.worker_ids?.includes(user?.id)
      );

      setTestResult(workerAvailable ? 'covered' : 'not-covered');
      
      toast({
        title: workerAvailable ? "ZIP Code Covered" : "ZIP Code Not Covered",
        description: workerAvailable 
          ? `You can receive jobs from ZIP code ${testZip}`
          : `You cannot receive jobs from ZIP code ${testZip}`,
        variant: workerAvailable ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Error testing ZIP coverage:', error);
      toast({
        title: "Test Failed",
        description: "Could not test ZIP code coverage",
        variant: "destructive"
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (totalZips === 0) {
    return (
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-orange-700">No Service Coverage Set</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-600 mb-3">
            You haven't set up any service areas yet. You won't receive any job assignments until you configure your coverage.
          </p>
          <p className="text-xs text-orange-500">
            Go to the "Service Area" tab to set up your coverage using the map or by adding ZIP codes manually.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-700">Service Coverage</CardTitle>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-300">
            {totalZips} ZIPs in {totalAreas} areas
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-green-600">
          <p>✓ You're set up to receive jobs from <strong>{totalZips} ZIP codes</strong> across <strong>{totalAreas} service areas</strong></p>
        </div>
        
        {/* ZIP Code Test Utility */}
        <div className="border-t border-green-200 pt-4">
          <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Test ZIP Code Coverage
          </h4>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter ZIP code (e.g., 75201)"
              value={testZip}
              onChange={(e) => {
                setTestZip(e.target.value);
                setTestResult(null);
              }}
              maxLength={5}
              className="flex-1"
            />
            <Button 
              onClick={testZipCoverage}
              disabled={testLoading || testZip.length !== 5}
              size="sm"
            >
              {testLoading ? 'Testing...' : 'Test'}
            </Button>
          </div>
          
          {testResult && (
            <div className={`mt-2 flex items-center gap-2 text-sm ${
              testResult === 'covered' ? 'text-green-600' : 'text-red-600'
            }`}>
              {testResult === 'covered' ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>You can receive jobs from ZIP {testZip}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span>You cannot receive jobs from ZIP {testZip}</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};