import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useComprehensiveZipcodeValidation } from '@/hooks/useComprehensiveZipValidation';
import { useOptimizedZipcodeValidation } from '@/hooks/useOptimizedZipcodeValidation';

interface ZipcodeLocationInputProps {
  onLocationConfirmed: (locationData: {
    zipcode: string;
    city: string;
    state: string;
    hasCoverage: boolean;
    workerCount: number;
  }) => void;
  initialZipcode?: string;
  className?: string;
}

export const ZipcodeLocationInput: React.FC<ZipcodeLocationInputProps> = ({
  onLocationConfirmed,
  initialZipcode = '',
  className = ''
}) => {
  const [zipcode, setZipcode] = useState(initialZipcode);
  const [isValidating, setIsValidating] = useState(false);
  
  // Try comprehensive validation first, fallback to optimized
  const { validateZipcode: validateComprehensive, result: comprehensiveResult } = useComprehensiveZipcodeValidation();
  const optimizedValidation = useOptimizedZipcodeValidation();
  
  // Use the best available result
  const result = comprehensiveResult.isValid ? comprehensiveResult : {
    isValid: optimizedValidation.isValid,
    hasCoverage: optimizedValidation.hasServiceCoverage,
    workerCount: optimizedValidation.workerCount,
    city: optimizedValidation.locationData?.city,
    state: optimizedValidation.locationData?.state,
    loading: optimizedValidation.isLoading,
    error: optimizedValidation.error
  };

  const handleValidateZipcode = async () => {
    if (!zipcode || zipcode.length !== 5) return;
    
    setIsValidating(true);
    
    try {
      // Try comprehensive validation first
      let validationResult = await validateComprehensive(zipcode);
      
      // If comprehensive fails, fallback to optimized
      if (!validationResult.isValid) {
        const optimizedResult = await optimizedValidation.validateZipcode(zipcode);
        validationResult = {
          isValid: optimizedResult.isValid,
          hasCoverage: optimizedResult.hasServiceCoverage,
          workerCount: optimizedResult.workerCount,
          city: optimizedResult.locationData?.city,
          state: optimizedResult.locationData?.state,
          loading: false,
          dataSource: 'optimized'
        };
      }
      
      if (validationResult.isValid) {
        onLocationConfirmed({
          zipcode,
          city: validationResult.city || '',
          state: validationResult.state || '',
          hasCoverage: validationResult.hasCoverage,
          workerCount: validationResult.workerCount
        });
      }
    } catch (error) {
      console.error('ZIP code validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidateZipcode();
    }
  };

  const formatZipcode = (value: string) => {
    // Only allow digits and limit to 5 characters
    const digits = value.replace(/\D/g, '').slice(0, 5);
    setZipcode(digits);
  };

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Service Location</span>
        </div>
        
        <div className="flex gap-2">
          <Input
            placeholder="Enter ZIP code"
            value={zipcode}
            onChange={(e) => formatZipcode(e.target.value)}
            onKeyPress={handleKeyPress}
            maxLength={5}
            className="flex-1"
            disabled={isValidating}
          />
          <Button 
            onClick={handleValidateZipcode}
            disabled={!zipcode || zipcode.length !== 5 || isValidating}
            size="default"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Validate'
            )}
          </Button>
        </div>

        {/* Validation Results */}
        {result.loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating ZIP code...
          </div>
        )}

        {result.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {result.error}
          </div>
        )}

        {result.isValid && !result.loading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                {result.city}, {result.state}
              </span>
              {result.dataSource && (
                <Badge variant={result.dataSource === 'comprehensive' ? 'default' : 'secondary'} className="text-xs">
                  {result.dataSource === 'comprehensive' ? 'Enhanced' : 'Standard'}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant={result.hasCoverage ? 'default' : 'destructive'}
                className="text-xs"
              >
                {result.hasCoverage ? '✓ Service Available' : '✗ No Service'}
              </Badge>
              {result.hasCoverage && (
                <span className="text-xs text-muted-foreground">
                  {result.workerCount} technician{result.workerCount !== 1 ? 's' : ''} available
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};