import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle, DollarSign } from 'lucide-react';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';
import { PricingEngine } from '@/utils/pricingEngine';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const PricingIntegrityMonitor = () => {
  const { services, loading: servicesLoading } = usePublicServicesData();
  const [validationResult, setValidationResult] = useState<{
    isConsistent: boolean;
    mismatches: Array<{
      addOnKey: string;
      configPrice: number;
      basePrice: number;
      serviceName: string;
    }>;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (services.length > 0) {
      validatePricing();
    }
  }, [services]);

  const validatePricing = async () => {
    const result = await PricingEngine.validateAllPricing(services);
    setValidationResult(result);
    setLastChecked(new Date());
  };

  const handleAutoSync = async () => {
    setSyncing(true);
    try {
      const tvMountingService = services.find(s => s.name === 'Mount TV');
      if (!tvMountingService) {
        throw new Error('Mount TV service not found');
      }

      // Get all add-on services
      const over65Service = services.find(s => s.name === 'Over 65" TV Add-on');
      const frameMountService = services.find(s => s.name === 'Frame Mount Add-on');
      const soundbarService = services.find(s => s.name === 'Mount Soundbar');

      // Build updated pricing_config with correct prices from base_price
      const updatedPricingConfig = {
        ...tvMountingService.pricing_config,
        add_ons: {
          over65: over65Service?.base_price || 25,
          frameMount: frameMountService?.base_price || 40,
          soundbar: soundbarService?.base_price || 40,
          specialWall: 40 // Standardized price for special walls
        }
      };

      // Update the Mount TV service pricing_config
      const { error } = await supabase
        .from('services')
        .update({ pricing_config: updatedPricingConfig })
        .eq('name', 'Mount TV');

      if (error) throw error;

      toast({
        title: 'Pricing Synchronized',
        description: 'All add-on prices have been synced successfully.',
      });

      // Re-validate after sync
      setTimeout(validatePricing, 1000);
    } catch (error: any) {
      console.error('Auto-sync failed:', error);
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (servicesLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Integrity Monitor
          </CardTitle>
          <CardDescription className="text-slate-400">Loading pricing data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Integrity Monitor
            </CardTitle>
            <CardDescription className="text-slate-400">
              Real-time validation of TV mounting add-on pricing
            </CardDescription>
          </div>
          <Button
            onClick={validatePricing}
            variant="outline"
            size="sm"
            disabled={servicesLoading}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {validationResult?.isConsistent ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-green-400 font-medium">All prices are consistent</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-400 font-medium">
                  {validationResult?.mismatches.length || 0} pricing mismatch(es) detected
                </span>
              </>
            )}
          </div>
          {lastChecked && (
            <span className="text-xs text-slate-500">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Mismatch Details */}
        {validationResult && !validationResult.isConsistent && (
          <Alert className="bg-red-900/20 border-red-500/30">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-200">
              <div className="space-y-3 mt-2">
                <p className="font-medium">Detected pricing inconsistencies:</p>
                {validationResult.mismatches.map((mismatch, index) => (
                  <div key={index} className="bg-slate-800/50 p-3 rounded-md space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{mismatch.serviceName}</span>
                      <Badge variant="destructive" className="bg-red-600/20 text-red-300 border-red-500/30">
                        Mismatch
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">pricing_config.add_ons.{mismatch.addOnKey}:</span>
                        <span className="text-red-300 font-mono">${mismatch.configPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Service base_price:</span>
                        <span className="text-green-300 font-mono">${mismatch.basePrice}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Auto-Sync Button */}
        {validationResult && !validationResult.isConsistent && (
          <div className="pt-2">
            <Button
              onClick={handleAutoSync}
              disabled={syncing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Synchronizing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Auto-Sync Prices (Use base_price as source of truth)
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              This will update pricing_config.add_ons to match individual service base_price values
            </p>
          </div>
        )}

        {/* Correct Prices Reference */}
        <div className="bg-slate-900/50 p-4 rounded-md">
          <p className="text-xs font-medium text-slate-400 mb-2">Correct Add-on Prices:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Over 65" TV:</span>
              <span className="text-green-400 font-mono">$25</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Frame Mount:</span>
              <span className="text-green-400 font-mono">$40</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Special Wall:</span>
              <span className="text-green-400 font-mono">$40</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mount Soundbar:</span>
              <span className="text-green-400 font-mono">$40</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
