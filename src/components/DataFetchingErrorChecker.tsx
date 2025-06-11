
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Database, Users, Calendar, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  name: string;
  status: 'idle' | 'testing' | 'success' | 'error';
  error?: string;
  details?: string;
}

export const DataFetchingErrorChecker = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([
    { name: 'Services Fetch', status: 'idle' },
    { name: 'Users/Profile Fetch', status: 'idle' },
    { name: 'Bookings Fetch', status: 'idle' },
    { name: 'RLS Policies Check', status: 'idle' },
    { name: 'Database Connection', status: 'idle' }
  ]);
  
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const updateTestResult = (name: string, status: TestResult['status'], error?: string, details?: string) => {
    setTestResults(prev => prev.map(test => 
      test.name === name ? { ...test, status, error, details } : test
    ));
  };

  const testServicesAccess = async () => {
    updateTestResult('Services Fetch', 'testing');
    
    try {
      console.log('Testing services access...');
      const { data, error, count } = await supabase
        .from('services')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

      if (error) {
        console.error('Services fetch error:', error);
        updateTestResult('Services Fetch', 'error', error.message, `Code: ${error.code}, Details: ${error.details}`);
        return;
      }

      console.log('Services fetch successful:', { count, dataLength: data?.length });
      updateTestResult('Services Fetch', 'success', undefined, `Found ${count || data?.length || 0} active services`);
    } catch (error) {
      console.error('Services fetch exception:', error);
      updateTestResult('Services Fetch', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testUsersAccess = async () => {
    updateTestResult('Users/Profile Fetch', 'testing');
    
    try {
      console.log('Testing users/profile access...');
      
      if (!user) {
        updateTestResult('Users/Profile Fetch', 'error', 'No authenticated user', 'User must be logged in to test profile access');
        return;
      }

      // Test own profile access
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        updateTestResult('Users/Profile Fetch', 'error', profileError.message, `Code: ${profileError.code}`);
        return;
      }

      if (!profileData) {
        updateTestResult('Users/Profile Fetch', 'error', 'Profile not found', 'User profile does not exist in users table');
        return;
      }

      // Test general users access (admin only)
      if (profile?.role === 'admin') {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, role')
          .limit(5);

        if (usersError) {
          console.error('Users fetch error:', usersError);
          updateTestResult('Users/Profile Fetch', 'error', usersError.message, 'Admin users access failed');
          return;
        }

        updateTestResult('Users/Profile Fetch', 'success', undefined, `Profile found. Admin access: ${usersData?.length || 0} users visible`);
      } else {
        updateTestResult('Users/Profile Fetch', 'success', undefined, `Own profile found. Role: ${profileData.role}`);
      }
    } catch (error) {
      console.error('Users fetch exception:', error);
      updateTestResult('Users/Profile Fetch', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testBookingsAccess = async () => {
    updateTestResult('Bookings Fetch', 'testing');
    
    try {
      console.log('Testing bookings access...');
      
      if (!user) {
        updateTestResult('Bookings Fetch', 'error', 'No authenticated user', 'User must be logged in to test bookings access');
        return;
      }

      const { data, error, count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact' })
        .limit(10);

      if (error) {
        console.error('Bookings fetch error:', error);
        updateTestResult('Bookings Fetch', 'error', error.message, `Code: ${error.code}, Details: ${error.details}`);
        return;
      }

      console.log('Bookings fetch successful:', { count, dataLength: data?.length });
      updateTestResult('Bookings Fetch', 'success', undefined, `Access granted. Found ${count || data?.length || 0} bookings`);
    } catch (error) {
      console.error('Bookings fetch exception:', error);
      updateTestResult('Bookings Fetch', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testRLSPolicies = async () => {
    updateTestResult('RLS Policies Check', 'testing');
    
    try {
      console.log('Testing RLS policies...');
      
      // Check if RLS is enabled on key tables
      const { data: rlsData, error: rlsError } = await supabase
        .rpc('get_rls_status', {})
        .single();

      if (rlsError) {
        // RLS check function doesn't exist, so we'll check differently
        console.log('RLS function not available, checking table access patterns...');
        
        // Test access patterns that would reveal RLS issues
        const tests = [
          { table: 'services', shouldWork: true },
          { table: 'users', shouldWork: !!user },
          { table: 'bookings', shouldWork: !!user }
        ];

        let rlsIssues = [];
        
        for (const test of tests) {
          try {
            const { error } = await supabase
              .from(test.table as any)
              .select('id')
              .limit(1);
            
            if (error && error.message.includes('row-level security')) {
              if (test.shouldWork) {
                rlsIssues.push(`${test.table}: RLS blocking expected access`);
              }
            } else if (!error && !test.shouldWork) {
              rlsIssues.push(`${test.table}: RLS not protecting unauthorized access`);
            }
          } catch (e) {
            rlsIssues.push(`${test.table}: Access test failed`);
          }
        }

        if (rlsIssues.length > 0) {
          updateTestResult('RLS Policies Check', 'error', 'RLS issues detected', rlsIssues.join('; '));
        } else {
          updateTestResult('RLS Policies Check', 'success', undefined, 'RLS policies appear to be working correctly');
        }
      } else {
        updateTestResult('RLS Policies Check', 'success', undefined, 'RLS status check completed');
      }
    } catch (error) {
      console.error('RLS check exception:', error);
      updateTestResult('RLS Policies Check', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testDatabaseConnection = async () => {
    updateTestResult('Database Connection', 'testing');
    
    try {
      console.log('Testing database connection...');
      
      const { data, error } = await supabase
        .from('services')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Database connection error:', error);
        updateTestResult('Database Connection', 'error', error.message, `Connection failed: ${error.code}`);
        return;
      }

      updateTestResult('Database Connection', 'success', undefined, 'Database connection is working');
    } catch (error) {
      console.error('Database connection exception:', error);
      updateTestResult('Database Connection', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const runAllTests = async () => {
    console.log('Running all data fetching tests...');
    
    await testDatabaseConnection();
    await testServicesAccess();
    await testUsersAccess();
    await testBookingsAccess();
    await testRLSPolicies();
    
    toast({
      title: "Data Fetching Tests Complete",
      description: "Check the results below for any issues",
    });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'testing': return <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default: return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <Badge variant="default" className="bg-green-600">Pass</Badge>;
      case 'error': return <Badge variant="destructive">Fail</Badge>;
      case 'testing': return <Badge variant="secondary">Testing...</Badge>;
      default: return <Badge variant="outline">Not Tested</Badge>;
    }
  };

  return (
    <Card className="bg-red-50 border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-red-800">
          <AlertTriangle className="h-5 w-5" />
          <span>Data Fetching Error Checker</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current User Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-red-700">Current User Status</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Authenticated:</span>
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

        {/* Test Results */}
        <div className="space-y-3">
          <h4 className="font-medium text-red-700">Data Access Tests</h4>
          {testResults.map((test, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  {getStatusIcon(test.status)}
                  <span>{test.name}</span>
                </span>
                {getStatusBadge(test.status)}
              </div>
              
              {test.error && (
                <div className="ml-6 p-2 bg-red-100 border border-red-200 rounded text-sm">
                  <div className="font-medium text-red-800">Error: {test.error}</div>
                  {test.details && (
                    <div className="text-red-600 mt-1">{test.details}</div>
                  )}
                </div>
              )}
              
              {test.status === 'success' && test.details && (
                <div className="ml-6 p-2 bg-green-100 border border-green-200 rounded text-sm">
                  <div className="text-green-700">{test.details}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Test Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runAllTests}
            disabled={testResults.some(t => t.status === 'testing')}
            className="bg-red-600 hover:bg-red-700"
          >
            {testResults.some(t => t.status === 'testing') ? 'Testing...' : 'Run All Tests'}
          </Button>
          
          <Button onClick={testDatabaseConnection} disabled={testResults.find(t => t.name === 'Database Connection')?.status === 'testing'} variant="outline" size="sm">
            <Database className="h-4 w-4 mr-1" />
            DB
          </Button>
          
          <Button onClick={testServicesAccess} disabled={testResults.find(t => t.name === 'Services Fetch')?.status === 'testing'} variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" />
            Services
          </Button>
          
          <Button onClick={testUsersAccess} disabled={testResults.find(t => t.name === 'Users/Profile Fetch')?.status === 'testing'} variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1" />
            Users
          </Button>
          
          <Button onClick={testBookingsAccess} disabled={testResults.find(t => t.name === 'Bookings Fetch')?.status === 'testing'} variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-1" />
            Bookings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
