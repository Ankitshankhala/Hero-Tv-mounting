import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';
import GoogleCalendarIntegration from '@/components/GoogleCalendarIntegration';
import { GoogleCalendarTester } from './GoogleCalendarTester';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { BookingCalendarSyncList } from './BookingCalendarSyncList';
import { SystemStatusCard } from './SystemStatusCard';
import { useBookingManager } from '@/hooks/useBookingManager';
import { AuthGuard } from '@/components/AuthGuard';
import { ConnectionTester } from '@/components/ConnectionTester';
import { useToast } from '@/hooks/use-toast';

export const BookingsManager = () => {
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { isCalendarConnected: calendarConnected } = useBookingCalendarSync();
  const { toast } = useToast();

  // Use our custom hook for booking management
  const { bookings, loading, handleBookingUpdate, fetchBookings, refetchBookings } = useBookingManager(isCalendarConnected);

  // Memoize the booking update callback to prevent unnecessary re-subscriptions
  const memoizedBookingUpdate = useCallback((booking: any) => {
    console.log('Memoized booking update received:', booking);
    handleBookingUpdate(booking);
  }, [handleBookingUpdate]);

  // Set up real-time subscriptions for admin
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: memoizedBookingUpdate
  });

  // Update calendar connection state
  useEffect(() => {
    setIsCalendarConnected(calendarConnected);
  }, [calendarConnected]);

  // Apply filters to bookings
  useEffect(() => {
    console.log('Applying filters to bookings. Total bookings:', bookings.length);
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

    console.log('Filtered bookings:', filtered.length, 'out of', bookings.length);
    setFilteredBookings(filtered);
  }, [bookings, filterStatus, filterRegion, searchTerm]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('Manual refresh triggered');
      await fetchBookings();
      refetchBookings();
      toast({
        title: "Refreshed",
        description: "Bookings data has been refreshed",
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast({
        title: "Error",
        description: "Failed to refresh bookings",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleBookingUpdateWrapper = () => {
    console.log('Booking updated, refreshing data...');
    handleRefresh();
  };

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        {/* Connection Tester */}
        <ConnectionTester />

        {/* System Status Card */}
        <SystemStatusCard 
          isConnected={isConnected}
          isCalendarConnected={isCalendarConnected}
        />

        {/* Google Calendar Integration Card */}
        <GoogleCalendarIntegration 
          onConnectionChange={(connected) => setIsCalendarConnected(connected)}
        />

        {/* Google Calendar Integration Tester */}
        <GoogleCalendarTester />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Bookings Management</span>
              </CardTitle>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
                {isConnected && (
                  <span className="text-sm text-green-600 flex items-center">
                    ● Live updates enabled
                  </span>
                )}
                {isCalendarConnected && (
                  <span className="text-sm text-blue-600 flex items-center">
                    ● Calendar sync active
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">Loading bookings...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Total Bookings:</strong> {bookings.length} | 
                    <strong> Filtered:</strong> {filteredBookings.length} | 
                    <strong> Real-time:</strong> {isConnected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>

                <BookingFilters
                  searchTerm={searchTerm}
                  filterStatus={filterStatus}
                  filterRegion={filterRegion}
                  onSearchChange={setSearchTerm}
                  onStatusChange={setFilterStatus}
                  onRegionChange={setFilterRegion}
                />

                <BookingTable 
                  bookings={filteredBookings} 
                  onBookingUpdate={handleBookingUpdateWrapper}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Calendar sync components for all bookings when calendar is connected */}
        <BookingCalendarSyncList 
          bookings={filteredBookings}
          isCalendarConnected={isCalendarConnected}
        />
      </div>
    </AuthGuard>
  );
};

export default BookingsManager;
