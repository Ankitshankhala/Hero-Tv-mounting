import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const StorageCacheOptimizer = () => {
  const [optimizing, setOptimizing] = useState(false);
  const [lastOptimization, setLastOptimization] = useState<{
    totalFiles: number;
    processed: number;
    errors: number;
    timestamp: Date;
  } | null>(null);
  const { toast } = useToast();

  const optimizeCacheControl = async () => {
    setOptimizing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('storage-cache-control', {
        body: {}
      });

      if (error) throw error;

      setLastOptimization({
        totalFiles: data.totalFiles,
        processed: data.processed,
        errors: data.errors,
        timestamp: new Date()
      });

      toast({
        title: "Cache Optimization Complete",
        description: `Processed ${data.processed} files with ${data.errors} errors`,
        variant: data.errors > 0 ? "destructive" : "default"
      });

    } catch (error) {
      console.error('Cache optimization failed:', error);
      toast({
        title: "Optimization Failed",
        description: "Failed to optimize storage cache control",
        variant: "destructive"
      });
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Storage Cache Optimization
        </CardTitle>
        <CardDescription className="text-slate-400">
          Optimize image cache lifetimes for better SEO performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-300">
          <p>This tool will update all existing service images to use 1-year cache control headers, 
          improving page load times and SEO scores.</p>
        </div>

        {lastOptimization && (
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-slate-300">Last optimization: {lastOptimization.timestamp.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs text-slate-400">
              <div>
                <span className="text-slate-300">{lastOptimization.totalFiles}</span>
                <div>Total Files</div>
              </div>
              <div>
                <span className="text-green-400">{lastOptimization.processed}</span>
                <div>Processed</div>
              </div>
              <div>
                <span className={lastOptimization.errors > 0 ? "text-red-400" : "text-slate-400"}>
                  {lastOptimization.errors}
                </span>
                <div>Errors</div>
              </div>
            </div>
          </div>
        )}

        <Button 
          onClick={optimizeCacheControl}
          disabled={optimizing}
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          {optimizing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Optimizing Cache Control...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Optimize Storage Cache
            </>
          )}
        </Button>

        <div className="text-xs text-slate-400 bg-slate-700/30 rounded p-3">
          <AlertCircle className="h-4 w-4 inline mr-1" />
          Note: This process may take several minutes for large image collections. 
          New uploads automatically use optimized cache settings.
        </div>
      </CardContent>
    </Card>
  );
};