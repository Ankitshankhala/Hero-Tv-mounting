
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Database, Wifi, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export const ConnectionTester = () => {
  const [testResults, setTestResults] = useState({
    supabaseConnection: 'idle' as 'idle' | 'testing' | 'success' | 'error',
    authentication: 'idle' as 'idle' | 'testing' | 'success' | 'error',
    dataAccess: 'idle' as 'idle' | 'testing' | 'success' | 'error'
  });
  const [testDetails, setTestDetails] = useState<string[]>([]);
  
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const addTestDetail = (message: string) => {
    setTestDetails(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testSupabaseConnection = async () => {
    setTestResults(prev => ({ ...prev, supabaseConnection: 'testing' }));
    setTestDetails([]);
    addTestDetail('Testing Supabase connection...');

    try {
      const { data, error } = await supabase.from('services').select('count').limit(1);
      
      if (error) {
        setTestResults(prev => ({ ...prev, supabaseConnection: 'error' }));
        addTestDetail(`❌ Supabase connection failed: ${error.message}`);
        return false;
      }

      setTestResults(prev => ({ ...prev, supabaseConnection: 'success' }));
      addTestDetail('✅ Supabase connection successful');
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, supabaseConnection: 'error' }));
      addTestDetail(`❌ Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const testAuthentication = async () => {
    setTestResults(prev => ({ ...prev, authentication: 'testing' }));
    addTestDetail('Testing authentication...');

    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        setTestResults(prev => ({ ...prev, authentication: 'error' }));
        addTestDetail(`❌ Authentication check failed: ${error.message}`);
        return false;
      }

      if (!authUser) {
        setTestResults(prev => ({ ...prev, authentication: 'error' }));
        addTestDetail('❌ No authenticated user found');
        return false;
      }

      setTestResults(prev => ({ ...prev, authentication: 'success' }));
      addTestDetail(`✅ User authenticated: ${authUser.email}`);
      addTestDetail(`User role: ${profile?.role || 'Unknown'}`);
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, authentication: 'error' }));
      addTestDetail(`❌ Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const testDataAccess = async () => {
    setTestResults(prev => ({ ...prev, dataAccess: 'testing' }));
    addTestDetail('Testing data access with RLS...');

    try {
      // Test services access (should work for everyone)
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, name')
        .limit(1);

      if (servicesError) {
        addTestDetail(`❌ Services access failed: ${servicesError.message}`);
      } else {
        addTestDetail(`✅ Services access successful (${services?.length || 0} records)`);
      }

      // Test user profile access
      if (user) {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          addTestDetail(`❌ Profile access failed: ${profileError.message}`);
        } else if (userProfile) {
          addTestDetail(`✅ Profile access successful: ${userProfile.name} (${userProfile.role})`);
        } else {
          addTestDetail('❌ No profile found for current user');
        }
      }

      // Test bookings access (role-specific)
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .limit(1);

      if (bookingsError) {
        if (bookingsError.message.includes('row-level security')) {
          addTestDetail('ℹ️ Bookings access restricted by RLS (this is expected)');
        } else {
          addTestDetail(`❌ Bookings access failed: ${bookingsError.message}`);
        }
      } else {
        addTestDetail(`✅ Bookings access successful (${bookings?.length || 0} records visible)`);
      }

      setTestResults(prev => ({ ...prev, dataAccess: 'success' }));
      addTestDetail('✅ Data access test completed');
      return true;
    } catch (error) {
      setTestResults(prev => ({ ...prev, dataAccess: 'error' }));
      addTestDetail(`❌ Data access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const runAllTests = async () => {
    const connectionOk = await testSupabaseConnection();
    if (connectionOk) {
      const authOk = await testAuthentication();
      if (authOk) {
        await testDataAccess();
      }
    }
    
    toast({
      title: "Tests Completed",
      description: "Check the results below for any issues",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'testing': return <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default: return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge variant="default" className="bg-green-600">Passed</Badge>;
      case 'error': return <Badge variant="destructive">Failed</Badge>;
      case 'testing': return <Badge variant="secondary">Testing...</Badge>;
      default: return <Badge variant="outline">Not Tested</Badge>;
    }
  };

  return (
    <Card className="bg-green-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-green-800">
          <Database className="h-5 w-5" />
          <span>Supabase Connection & RLS Tester</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-green-700">Connection Test</h4>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                {getStatusIcon(testResults.supabaseConnection)}
                <span>Supabase API</span>
              </span>
              {getStatusBadge(testResults.supabaseConnection)}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-green-700">Authentication</h4>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                {getStatusIcon(testResults.authentication)}
                <span>User Auth</span>
              </span>
              {getStatusBadge(testResults.authentication)}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-green-700">Data Access</h4>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                {getStatusIcon(testResults.dataAccess)}
                <span>RLS Policies</span>
              </span>
              {getStatusBadge(testResults.dataAccess)}
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-green-700">Current Status</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Connected:</span>
                <Badge variant={user ? "default" : "destructive"}>
                  {user ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>User Role:</span>
                <Badge variant="outline">
                  {profile?.role || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>User ID:</span>
                <span className="text-xs font-mono">
                  {user?.id?.slice(0, 8) || 'None'}...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={runAllTests}
            disabled={Object.values(testResults).some(s => s === 'testing')}
            className="bg-green-600 hover:bg-green-700"
          >
            {Object.values(testResults).some(s => s === 'testing') ? 'Testing...' : 'Run All Tests'}
          </Button>
          
          <Button
            onClick={testSupabaseConnection}
            disabled={testResults.supabaseConnection === 'testing'}
            variant="outline"
          >
            Test Connection
          </Button>

          <Button
            onClick={testAuthentication}
            disabled={testResults.authentication === 'testing'}
            variant="outline"
          >
            Test Auth
          </Button>

          <Button
            onClick={testDataAccess}
            disabled={testResults.dataAccess === 'testing'}
            variant="outline"
          >
            Test Data Access
          </Button>
        </div>

        {/* Test Details */}
        {testDetails.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-green-700">Test Details:</h4>
            <div className="bg-white border rounded p-3 max-h-48 overflow-y-auto">
              {testDetails.map((detail, index) => (
                <div key={index} className="text-sm text-gray-700 font-mono">
                  {detail}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
