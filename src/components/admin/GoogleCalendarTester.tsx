
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useToast } from '@/hooks/use-toast';

export const GoogleCalendarTester = () => {
  const [testResults, setTestResults] = useState<{
    connection: 'idle' | 'testing' | 'success' | 'error';
    eventCreation: 'idle' | 'testing' | 'success' | 'error';
    eventUpdate: 'idle' | 'testing' | 'success' | 'error';
    eventDeletion: 'idle' | 'testing' | 'success' | 'error';
    details: string[];
  }>({
    connection: 'idle',
    eventCreation: 'idle',
    eventUpdate: 'idle',
    eventDeletion: 'idle',
    details: []
  });

  const { 
    isConnected, 
    isLoading,
    configurationError,
    connectToGoogleCalendar,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent
  } = useGoogleCalendar();
  
  const { toast } = useToast();

  const addTestDetail = (message: string) => {
    setTestResults(prev => ({
      ...prev,
      details: [...prev.details, `${new Date().toLocaleTimeString()}: ${message}`]
    }));
  };

  const testConnection = async () => {
    setTestResults(prev => ({ ...prev, connection: 'testing', details: [] }));
    addTestDetail('Testing Google Calendar connection...');

    try {
      if (!isConnected) {
        addTestDetail('Attempting to connect to Google Calendar...');
        const success = await connectToGoogleCalendar();
        
        if (success) {
          setTestResults(prev => ({ ...prev, connection: 'success' }));
          addTestDetail('✅ Successfully connected to Google Calendar');
          toast({
            title: "Connection Test Passed",
            description: "Google Calendar connection successful",
          });
        } else {
          setTestResults(prev => ({ ...prev, connection: 'error' }));
          addTestDetail('❌ Failed to connect to Google Calendar');
          toast({
            title: "Connection Test Failed",
            description: "Could not connect to Google Calendar",
            variant: "destructive",
          });
        }
      } else {
        setTestResults(prev => ({ ...prev, connection: 'success' }));
        addTestDetail('✅ Already connected to Google Calendar');
        toast({
          title: "Connection Test Passed",
          description: "Google Calendar is already connected",
        });
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, connection: 'error' }));
      addTestDetail(`❌ Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: "Connection Test Failed",
        description: "An error occurred during connection",
        variant: "destructive",
      });
    }
  };

  const testFullIntegration = async () => {
    if (!isConnected) {
      toast({
        title: "Not Connected",
        description: "Please connect to Google Calendar first",
        variant: "destructive",
      });
      return;
    }

    // Reset all test states
    setTestResults(prev => ({
      ...prev,
      eventCreation: 'testing',
      eventUpdate: 'idle',
      eventDeletion: 'idle',
      details: []
    }));

    let testEventId: string | null = null;

    try {
      // Test 1: Create Event
      addTestDetail('🧪 Testing event creation...');
      const testEvent = {
        summary: 'Google Calendar Integration Test',
        description: 'This is a test event created by the booking system integration test.',
        start: {
          dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        location: 'Integration Test Location'
      };

      const createdEvent = await createCalendarEvent(testEvent);
      
      if (createdEvent?.id) {
        testEventId = createdEvent.id;
        setTestResults(prev => ({ ...prev, eventCreation: 'success', eventUpdate: 'testing' }));
        addTestDetail('✅ Event creation successful');
        addTestDetail(`Event ID: ${testEventId}`);

        // Test 2: Update Event
        addTestDetail('🧪 Testing event update...');
        const updatedEvent = {
          ...testEvent,
          summary: 'Google Calendar Integration Test - UPDATED',
          description: 'This test event has been updated successfully.'
        };

        const updated = await updateCalendarEvent(testEventId, updatedEvent);
        
        if (updated) {
          setTestResults(prev => ({ ...prev, eventUpdate: 'success', eventDeletion: 'testing' }));
          addTestDetail('✅ Event update successful');

          // Test 3: Delete Event
          addTestDetail('🧪 Testing event deletion...');
          const deleted = await deleteCalendarEvent(testEventId);
          
          if (deleted) {
            setTestResults(prev => ({ ...prev, eventDeletion: 'success' }));
            addTestDetail('✅ Event deletion successful');
            addTestDetail('🎉 All integration tests passed!');
            
            toast({
              title: "Integration Test Passed",
              description: "All Google Calendar features are working correctly",
            });
          } else {
            setTestResults(prev => ({ ...prev, eventDeletion: 'error' }));
            addTestDetail('❌ Event deletion failed');
          }
        } else {
          setTestResults(prev => ({ ...prev, eventUpdate: 'error' }));
          addTestDetail('❌ Event update failed');
        }
      } else {
        setTestResults(prev => ({ ...prev, eventCreation: 'error' }));
        addTestDetail('❌ Event creation failed - no event ID returned');
      }
    } catch (error) {
      addTestDetail(`❌ Integration test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Try to clean up if we created an event
      if (testEventId) {
        try {
          await deleteCalendarEvent(testEventId);
          addTestDetail('🧹 Cleaned up test event');
        } catch (cleanupError) {
          addTestDetail('⚠️ Could not clean up test event');
        }
      }

      toast({
        title: "Integration Test Failed",
        description: "One or more tests failed - check details below",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'testing': return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
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
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-blue-800">
          <Calendar className="h-5 w-5" />
          <span>Google Calendar Integration Tester</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-700">Configuration Status</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Connected:</span>
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Configuration:</span>
                <Badge variant={configurationError ? "destructive" : "default"}>
                  {configurationError ? "Error" : "Valid"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Loading:</span>
                <Badge variant={isLoading ? "secondary" : "outline"}>
                  {isLoading ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-blue-700">Test Results</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  {getStatusIcon(testResults.connection)}
                  <span>Connection:</span>
                </span>
                {getStatusBadge(testResults.connection)}
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  {getStatusIcon(testResults.eventCreation)}
                  <span>Create Event:</span>
                </span>
                {getStatusBadge(testResults.eventCreation)}
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  {getStatusIcon(testResults.eventUpdate)}
                  <span>Update Event:</span>
                </span>
                {getStatusBadge(testResults.eventUpdate)}
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  {getStatusIcon(testResults.eventDeletion)}
                  <span>Delete Event:</span>
                </span>
                {getStatusBadge(testResults.eventDeletion)}
              </div>
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={testConnection}
            disabled={isLoading || testResults.connection === 'testing'}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {testResults.connection === 'testing' ? 'Testing...' : 'Test Connection'}
          </Button>
          
          <Button
            onClick={testFullIntegration}
            disabled={!isConnected || isLoading || Object.values(testResults).some(s => s === 'testing')}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
          >
            {Object.values(testResults).some(s => s === 'testing') ? 'Testing...' : 'Test Full Integration'}
          </Button>
        </div>

        {/* Configuration Error */}
        {configurationError && (
          <div className="bg-yellow-100 border border-yellow-400 rounded p-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-yellow-800 font-medium">Configuration Issue:</p>
                <p className="text-yellow-700 text-sm">{configurationError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Test Details */}
        {testResults.details.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-blue-700">Test Details:</h4>
            <div className="bg-white border rounded p-3 max-h-48 overflow-y-auto">
              {testResults.details.map((detail, index) => (
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
