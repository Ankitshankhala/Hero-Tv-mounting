
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
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

export const BookingsManager = () => {
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const { user } = useAuth();
  const { isCalendarConnected: calendarConnected } = useBookingCalendarSync();

  // Use our custom hook for booking management
  const { bookings, loading, handleBookingUpdate, fetchBookings } = useBookingManager(isCalendarConnected);

  // Set up real-time subscriptions for admin
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: handleBookingUpdate
  });

  // Update calendar connection state
  useEffect(() => {
    setIsCalendarConnected(calendarConnected);
  }, [calendarConnected]);

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

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="space-y-6">
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
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-gray-600">Loading bookings...</div>
              </div>
            ) : (
              <>
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
                  onBookingUpdate={fetchBookings}
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
