
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
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
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const { user } = useAuth();
  const { isCalendarConnected: calendarConnected } = useBookingCalendarSync();
  const { toast } = useToast();

  // Production configuration for booking manager
  const bookingManagerOptions = {
    enableAutoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    enableCalendarSync: true,
    enableToastNotifications: true
  };

  // Use enhanced booking manager hook
  const { 
    bookings, 
    loading, 
    error,
    handleBookingUpdate, 
    fetchBookings, 
    refetchBookings,
    getHealthStatus
  } = useBookingManager(isCalendarConnected, bookingManagerOptions);

  // Set up real-time subscriptions with error handling
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: handleBookingUpdate
  });

  // Update calendar connection state
  useEffect(() => {
    setIsCalendarConnected(calendarConnected);
  }, [calendarConnected]);

  // Enhanced filtering with performance optimization
  useEffect(() => {
    console.log('Applying filters to bookings. Total bookings:', bookings.length);
    
    let filtered = bookings;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(booking => booking.status === filterStatus);
    }

    // Apply region filter
    if (filterRegion !== 'all') {
      filtered = filtered.filter(booking => 
        booking.customer?.region?.toLowerCase() === filterRegion.toLowerCase()
      );
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(booking =>
        booking.customer?.name?.toLowerCase().includes(searchLower) ||
        booking.id.toLowerCase().includes(searchLower) ||
        booking.customer_address?.toLowerCase().includes(searchLower) ||
        booking.services?.some(service => 
          service.name?.toLowerCase().includes(searchLower)
        )
      );
    }

    console.log('Filtered bookings:', filtered.length, 'out of', bookings.length);
    setFilteredBookings(filtered);
  }, [bookings, filterStatus, filterRegion, searchTerm]);

  // Enhanced refresh handler with better UX
  const handleRefresh = useCallback(async () => {
    if (refreshing) return; // Prevent double refresh
    
    setRefreshing(true);
    try {
      console.log('Manual refresh triggered');
      await Promise.all([
        fetchBookings(),
        refetchBookings()
      ]);
      setLastRefreshTime(new Date());
      
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
  }, [fetchBookings, refetchBookings, toast, refreshing]);

  // Optimized booking update wrapper
  const handleBookingUpdateWrapper = useCallback(() => {
    console.log('Booking updated, refreshing data...');
    handleRefresh();
  }, [handleRefresh]);

  // Get system health for monitoring
  const healthStatus = getHealthStatus();

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        {/* Enhanced System Status */}
        <SystemStatusCard 
          isConnected={isConnected}
          isCalendarConnected={isCalendarConnected}
        />

        {/* Error Alert for Production Monitoring */}
        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-medium">System Error</p>
                  <p className="text-sm">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefresh}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Google Calendar Integration */}
        <GoogleCalendarIntegration 
          onConnectionChange={(connected) => setIsCalendarConnected(connected)}
        />

        {/* Development Tools - Could be removed in production */}
        <GoogleCalendarTester />
        <ConnectionTester />

        {/* Main Bookings Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Bookings Management</span>
              </CardTitle>
              <div className="flex items-center space-x-4">
                {/* Enhanced Status Indicators */}
                <div className="flex items-center space-x-4 text-sm">
                  {isConnected && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      <span>Live</span>
                    </div>
                  )}
                  {isCalendarConnected && (
                    <div className="flex items-center space-x-1 text-blue-600">
                      <CheckCircle className="h-3 w-3" />
                      <span>Calendar</span>
                    </div>
                  )}
                  {lastRefreshTime && (
                    <span className="text-muted-foreground text-xs">
                      Last: {lastRefreshTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="text-muted-foreground">Loading bookings...</span>
                </div>
              </div>
            ) : (
              <>
                {/* Enhanced Statistics */}
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Total:</span> {bookings.length}
                    </div>
                    <div>
                      <span className="font-medium">Filtered:</span> {filteredBookings.length}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span> 
                      <span className={`ml-1 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Health:</span>
                      <span className={`ml-1 ${error ? 'text-red-600' : 'text-green-600'}`}>
                        {error ? 'Issues' : 'Good'}
                      </span>
                    </div>
                  </div>
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

        {/* Calendar Sync Management */}
        <BookingCalendarSyncList 
          bookings={filteredBookings}
          isCalendarConnected={isCalendarConnected}
        />
      </div>
    </AuthGuard>
  );
};

export default BookingsManager;
