
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { CreateBookingModal } from './CreateBookingModal';
import { useBookingManager } from '@/hooks/useBookingManager';
import { AuthGuard } from '@/components/AuthGuard';

export const BookingsManager = () => {
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuth();

  // Use our custom hook for booking management
  const { bookings, loading, handleBookingUpdate, fetchBookings } = useBookingManager();

  // Set up real-time subscriptions for admin with stable callback
  const handleRealtimeUpdate = React.useCallback((updatedBooking: any) => {
    console.log('Real-time booking update received:', updatedBooking);
    handleBookingUpdate(updatedBooking);
    // Force a fresh fetch to ensure we have the latest data with all relations
    setTimeout(() => {
      fetchBookings();
    }, 1000);
  }, [handleBookingUpdate, fetchBookings]);

  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: handleRealtimeUpdate
  });

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

  const handleBookingCreated = () => {
    console.log('Booking created, refreshing list');
    fetchBookings();
  };

  const handleBookingUpdated = () => {
    console.log('Booking updated, refreshing list');
    fetchBookings();
  };

  return (
    <AuthGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Bookings Management</span>
              </CardTitle>
              <div className="flex items-center space-x-4">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Booking
                </Button>
                {isConnected && (
                  <span className="text-sm text-green-600">● Live updates enabled</span>
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
                  onBookingUpdate={handleBookingUpdated}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Booking Modal */}
        {showCreateModal && (
          <CreateBookingModal
            onClose={() => setShowCreateModal(false)}
            onBookingCreated={handleBookingCreated}
          />
        )}
      </div>
    </AuthGuard>
  );
};

export default BookingsManager;
