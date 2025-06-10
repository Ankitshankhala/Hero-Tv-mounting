
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Database, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';
import { useToast } from '@/hooks/use-toast';
import GoogleCalendarIntegration from '@/components/GoogleCalendarIntegration';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { BookingCalendarSyncList } from './BookingCalendarSyncList';
import { Button } from '@/components/ui/button';

export const BookingsManager = () => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [dbConnectionStatus, setDbConnectionStatus] = useState('testing');
  const [realtimeTestResult, setRealtimeTestResult] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const { syncBookingToCalendar, isCalendarConnected: calendarConnected } = useBookingCalendarSync();

  // Set up real-time subscriptions for admin
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: async (updatedBooking) => {
      console.log('Real-time booking update received:', updatedBooking);
      setRealtimeTestResult(`✅ Real-time update received at ${new Date().toLocaleTimeString()}: Booking ${updatedBooking.id} status changed`);
      
      setBookings(currentBookings => {
        const existingBookingIndex = currentBookings.findIndex(booking => booking.id === updatedBooking.id);
        let updatedBookings = [...currentBookings];
        
        if (existingBookingIndex >= 0) {
          const oldBooking = currentBookings[existingBookingIndex];
          updatedBookings[existingBookingIndex] = { ...oldBooking, ...updatedBooking };
          
          // Handle calendar sync for real-time updates if calendar is connected
          if (isCalendarConnected) {
            const bookingData = updatedBookings[existingBookingIndex];
            
            // Determine if this is a status change that needs calendar sync
            if (oldBooking.status !== updatedBooking.status) {
              // Use setTimeout to handle async operations without blocking the state update
              setTimeout(async () => {
                try {
                  if (updatedBooking.status === 'cancelled') {
                    // Delete from calendar
                    await syncBookingToCalendar(bookingData, 'delete');
                  } else if (oldBooking.status === 'pending' && updatedBooking.status === 'confirmed') {
                    // Create calendar event
                    await syncBookingToCalendar(bookingData, 'create');
                  } else {
                    // Update existing calendar event
                    await syncBookingToCalendar(bookingData, 'update');
                  }
                } catch (error) {
                  console.error('Error syncing calendar for real-time update:', error);
                }
              }, 0);
            }
          }
        } else {
          // Add new booking and sync to calendar if connected
          updatedBookings.unshift(updatedBooking);
          fetchBookings(); // Refetch to get complete data with relations
          
          if (isCalendarConnected && updatedBooking.status !== 'cancelled') {
            // Use setTimeout to handle async operations without blocking the state update
            setTimeout(async () => {
              try {
                await syncBookingToCalendar(updatedBooking, 'create');
              } catch (error) {
                console.error('Error syncing new booking to calendar:', error);
              }
            }, 0);
          }
        }
        
        return updatedBookings;
      });
    }
  });

  // Test database connection on component mount
  useEffect(() => {
    testDatabaseConnection();
  }, []);

  // Update calendar connection state
  useEffect(() => {
    setIsCalendarConnected(calendarConnected);
  }, [calendarConnected]);

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    // Apply filters
    let filtered = bookings;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(booking => booking.status === filterStatus);
    }

    if (filterRegion !== 'all') {
      filtered = filtered.filter(booking => 
        booking.customer?.region?.toLowerCase() === filterRegion.toLowerCase()
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.services?.some(service => 
          service.name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    setFilteredBookings(filtered);
  }, [bookings, filterStatus, filterRegion, searchTerm]);

  const testDatabaseConnection = async () => {
    console.log('Testing database connection...');
    try {
      // Test basic connection with a simple query
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
      // Create a test booking to trigger real-time updates
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
        
        // Update the test booking to trigger a real-time event
        setTimeout(async () => {
          await supabase
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', data.id);
        }, 1000);

        // Clean up test booking after 5 seconds
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

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:users!customer_id(name, phone, region),
          worker:users!worker_id(name, phone)
        `)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Card */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-800">System Status & Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Database Connection Status */}
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

            {/* Real-time Connection Status */}
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

            {/* Calendar Sync Status */}
            <div className="flex items-center space-x-2">
              <Calendar className={`h-5 w-5 ${isCalendarConnected ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="text-sm">
                Calendar: {isCalendarConnected ? '✅ Synced' : '⭕ Not connected'}
              </span>
            </div>
          </div>

          {/* Real-time Test Results */}
          {realtimeTestResult && (
            <div className="mt-4 p-3 bg-slate-100 rounded-md">
              <p className="text-sm text-slate-700">{realtimeTestResult}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Calendar Integration Card */}
      <GoogleCalendarIntegration 
        onConnectionChange={(connected) => setIsCalendarConnected(connected)}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Bookings Management</span>
            </CardTitle>
            <div className="flex items-center space-x-4">
              {isConnected && (
                <span className="text-sm text-green-600">● Live updates enabled</span>
              )}
              {isCalendarConnected && (
                <span className="text-sm text-blue-600">● Calendar sync active</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BookingFilters
            searchTerm={searchTerm}
            filterStatus={filterStatus}
            filterRegion={filterRegion}
            onSearchChange={setSearchTerm}
            onStatusChange={setFilterStatus}
            onRegionChange={setFilterRegion}
          />

          <BookingTable bookings={filteredBookings} />
        </CardContent>
      </Card>

      {/* Calendar sync components for all bookings when calendar is connected */}
      <BookingCalendarSyncList 
        bookings={filteredBookings}
        isCalendarConnected={isCalendarConnected}
      />
    </div>
  );
};

export default BookingsManager;
