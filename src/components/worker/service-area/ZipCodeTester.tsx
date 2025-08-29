import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ZipCodeTesterProps {
  activeZipcodes: string[];
}

export const ZipCodeTester: React.FC<ZipCodeTesterProps> = ({ activeZipcodes }) => {
  const [testZipcode, setTestZipcode] = useState('');
  const [testResult, setTestResult] = useState<{
    zipcode: string;
    inCoverage: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleTestZipcode = async () => {
    if (!testZipcode.trim() || !/^\d{5}$/.test(testZipcode)) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit ZIP code",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      // Check if ZIP is in active coverage
      const inCoverage = activeZipcodes.includes(testZipcode);
      
      let message = '';
      if (inCoverage) {
        message = 'This ZIP code is in your active service area. You will receive bookings from this area.';
      } else {
        message = 'This ZIP code is NOT in your service area. You will not receive bookings from this area.';
      }

      setTestResult({
        zipcode: testZipcode,
        inCoverage,
        message
      });

    } catch (error) {
      console.error('Error testing ZIP code:', error);
      toast({
        title: "Error",
        description: "Failed to test ZIP code",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTestZipcode();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          Test ZIP Code Coverage
        </CardTitle>
        <CardDescription>
          Check if a specific ZIP code is covered by your active service areas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter ZIP code (e.g. 75201)"
              value={testZipcode}
              onChange={(e) => setTestZipcode(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={5}
              pattern="\d{5}"
            />
          </div>
          <Button 
            onClick={handleTestZipcode}
            disabled={!testZipcode.trim() || testing}
          >
            <Search className="h-4 w-4 mr-2" />
            {testing ? 'Testing...' : 'Test'}
          </Button>
        </div>

        {testResult && (
          <div className={`p-4 border rounded-lg ${
            testResult.inCoverage 
              ? 'border-green-200 bg-green-50' 
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="font-mono font-medium">{testResult.zipcode}</span>
              </div>
              <Badge 
                variant={testResult.inCoverage ? "default" : "destructive"}
                className="flex items-center gap-1"
              >
                {testResult.inCoverage ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {testResult.inCoverage ? 'Covered' : 'Not Covered'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {testResult.message}
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <strong>Active Coverage:</strong> {activeZipcodes.length} ZIP codes
        </div>
      </CardContent>
    </Card>
  );
};