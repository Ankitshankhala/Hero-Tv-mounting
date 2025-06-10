
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Wifi, WifiOff, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface SystemStatusCardProps {
  isConnected: boolean;
  isCalendarConnected: boolean;
}

export const SystemStatusCard = ({ isConnected, isCalendarConnected }: SystemStatusCardProps) => {
  const [dbConnectionStatus, setDbConnectionStatus] = useState('testing');
  const [realtimeTestResult, setRealtimeTestResult] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    testDatabaseConnection();
  }, []);

  const testDatabaseConnection = async () => {
    console.log('Testing database connection...');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Database connection error:', error);
        setDbConnectionStatus('error');
        toast({
          title: "Database Connection Error",
          description: `Failed to connect: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Database connection successful:', data);
        setDbConnectionStatus('connected');
        toast({
          title: "Database Connected",
          description: "Successfully connected to Supabase database",
        });
      }
    } catch (error) {
      console.error('Database connection test failed:', error);
      setDbConnectionStatus('error');
      toast({
        title: "Database Connection Failed",
        description: "Could not establish connection to database",
        variant: "destructive",
      });
    }
  };

  const testRealtimeConnection = async () => {
    console.log('Testing real-time connection...');
    setRealtimeTestResult('🔄 Testing real-time connection...');
    
    try {
      const testBooking = {
        customer_id: user?.id || '00000000-0000-0000-0000-000000000000',
        scheduled_at: new Date().toISOString(),
        services: [{ name: 'Real-time Test', price: 0 }],
        total_price: 0,
        total_duration_minutes: 60,
        customer_address: 'Test Address',
        status: 'pending' as const
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert(testBooking)
        .select()
        .single();

      if (error) {
        console.error('Real-time test error:', error);
        setRealtimeTestResult(`❌ Real-time test failed: ${error.message}`);
        toast({
          title: "Real-time Test Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Test booking created:', data);
        setRealtimeTestResult('✅ Test booking created. Waiting for real-time update...');
        
        setTimeout(async () => {
          await supabase
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', data.id);
        }, 1000);

        setTimeout(async () => {
          await supabase
            .from('bookings')
            .delete()
            .eq('id', data.id);
        }, 5000);
      }
    } catch (error) {
      console.error('Real-time test failed:', error);
      setRealtimeTestResult(`❌ Real-time test failed: ${error.message}`);
    }
  };

  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-800">System Status & Testing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Database className={`h-5 w-5 ${dbConnectionStatus === 'connected' ? 'text-green-600' : dbConnectionStatus === 'error' ? 'text-red-600' : 'text-yellow-600'}`} />
            <span className="text-sm">
              Database: {dbConnectionStatus === 'connected' ? '✅ Connected' : dbConnectionStatus === 'error' ? '❌ Error' : '🔄 Testing...'}
            </span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={testDatabaseConnection}
              className="ml-2"
            >
              Test DB
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-600" />
            )}
            <span className="text-sm">
              Real-time: {isConnected ? '✅ Connected' : '❌ Disconnected'}
            </span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={testRealtimeConnection}
              className="ml-2"
            >
              Test RT
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className={`h-5 w-5 ${isCalendarConnected ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="text-sm">
              Calendar: {isCalendarConnected ? '✅ Synced' : '⭕ Not connected'}
            </span>
          </div>
        </div>

        {realtimeTestResult && (
          <div className="mt-4 p-3 bg-slate-100 rounded-md">
            <p className="text-sm text-slate-700">{realtimeTestResult}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
