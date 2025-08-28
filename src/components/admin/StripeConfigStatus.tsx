import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StripeConfigStatus {
  hasPublishableKey: boolean;
  keyType: string;
  isLive: boolean;
  secretKeyStatus: 'checking' | 'configured' | 'missing' | 'error';
  lastChecked?: Date;
}

export const StripeConfigStatus = () => {
  const [status, setStatus] = useState<StripeConfigStatus>({
    hasPublishableKey: false,
    keyType: 'unknown',
    isLive: false,
    secretKeyStatus: 'checking'
  });
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const checkStripeConfig = async () => {
    setIsChecking(true);
    
    try {
      // Check frontend publishable key
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
      const hasPublishableKey = !!publishableKey;
      const isLive = publishableKey.startsWith('pk_live_');
      const keyType = publishableKey.startsWith('pk_live_') ? 'live' : 
                     publishableKey.startsWith('pk_test_') ? 'test' : 'unknown';

      // Check backend secret key via edge function
      const { data, error } = await supabase.functions.invoke('test-stripe-config');
      
      if (error) {
        throw new Error(error.message);
      }

      setStatus({
        hasPublishableKey,
        keyType,
        isLive,
        secretKeyStatus: data?.success ? 'configured' : 'missing',
        lastChecked: new Date()
      });

    } catch (error) {
      console.error('Stripe config check failed:', error);
      setStatus(prev => ({
        ...prev,
        secretKeyStatus: 'error',
        lastChecked: new Date()
      }));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStripeConfig();
  }, []);

  const getStatusColor = () => {
    if (status.secretKeyStatus === 'configured' && status.hasPublishableKey) {
      return status.isLive ? 'bg-green-600' : 'bg-blue-600';
    }
    return 'bg-red-600';
  };

  const getStatusText = () => {
    if (status.secretKeyStatus === 'checking') return 'Checking...';
    if (!status.hasPublishableKey) return 'No Publishable Key';
    if (status.secretKeyStatus === 'missing') return 'No Secret Key';
    if (status.secretKeyStatus === 'error') return 'Config Error';
    return status.isLive ? 'Live Keys Active' : 'Test Keys Active';
  };

  const getStatusIcon = () => {
    if (status.secretKeyStatus === 'checking' || isChecking) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (status.secretKeyStatus === 'configured' && status.hasPublishableKey) {
      return <CheckCircle className="h-4 w-4" />;
    }
    if (status.secretKeyStatus === 'error') {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return <XCircle className="h-4 w-4" />;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          Stripe Configuration
          <Badge className={`${getStatusColor()} text-white`}>
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </CardTitle>
        <CardDescription className="text-slate-400">
          Payment processing configuration status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Frontend Keys</div>
            <div className="flex items-center gap-2">
              {status.hasPublishableKey ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm text-slate-400">
                {status.hasPublishableKey ? `${status.keyType} key` : 'No publishable key'}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Backend Keys</div>
            <div className="flex items-center gap-2">
              {status.secretKeyStatus === 'configured' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : status.secretKeyStatus === 'checking' ? (
                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm text-slate-400">
                {status.secretKeyStatus === 'configured' ? 'Secret key configured' :
                 status.secretKeyStatus === 'checking' ? 'Checking...' :
                 status.secretKeyStatus === 'missing' ? 'Secret key missing' :
                 'Configuration error'}
              </span>
            </div>
          </div>
        </div>

        {status.lastChecked && (
          <div className="text-xs text-slate-500">
            Last checked: {status.lastChecked.toLocaleTimeString()}
          </div>
        )}

        {(!status.hasPublishableKey || status.secretKeyStatus !== 'configured') && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-yellow-400">
              Stripe configuration incomplete. Payment processing may not work properly.
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={checkStripeConfig}
          disabled={isChecking}
          variant="outline"
          size="sm"
          className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          {isChecking ? 'Checking...' : 'Refresh Status'}
        </Button>
      </CardContent>
    </Card>
  );
};