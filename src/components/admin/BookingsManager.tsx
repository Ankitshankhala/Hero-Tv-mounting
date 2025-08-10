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
import { useToast } from '@/hooks/use-toast';
import { createTestBooking } from '@/utils/createTestBooking';
export const BookingsManager = () => {
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const {
    user
  } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  // Use our enhanced booking manager hook
  const {
    bookings,
    loading,
    handleBookingUpdate,
    fetchBookings
  } = useBookingManager();

  // Set up real-time subscriptions for admin with enhanced callback
  const handleRealtimeUpdate = React.useCallback((updatedBooking: any) => {
    console.log('Real-time booking update received in BookingsManager:', updatedBooking);

    // Use the enhanced update handler that enriches data
    handleBookingUpdate(updatedBooking);
  }, [handleBookingUpdate]);
  const {
    isConnected
  } = useRealtimeBookings({
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
      filtered = filtered.filter(booking => booking.customer?.region?.toLowerCase() === filterRegion.toLowerCase());
    }
    if (searchTerm) {
      filtered = filtered.filter(booking => booking.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || booking.id.toLowerCase().includes(searchTerm.toLowerCase()) || booking.services?.some(service => service.name?.toLowerCase().includes(searchTerm.toLowerCase())) || booking.worker?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    setFilteredBookings(filtered);
  }, [bookings, filterStatus, filterRegion, searchTerm]);
  const handleBookingCreated = () => {
    console.log('Booking created, refreshing list');
    fetchBookings();
  };
  const handleBookingUpdated = () => {
    console.log('Booking updated from BookingTable, refreshing list');
    fetchBookings();
  };
  const handleQuickTestBooking = async () => {
    try {
      setCreating(true);
      const booking = await createTestBooking();
      toast({
        title: 'Success',
        description: `Test booking created: ${booking.id}`,
      });
      fetchBookings();
    } catch (error) {
      console.error('Quick test booking failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to create test booking',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };
  return <AuthGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Bookings Management</span>
              </CardTitle>
              <div className="flex items-center space-x-4">
                <Button onClick={handleQuickTestBooking} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" />
                  {creating ? 'Creating…' : 'Quick E2E Test booking'}
                </Button>
                {isConnected && <span className="text-sm text-green-600">● Live updates enabled</span>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center p-8">
                <div className="text-gray-600">Loading bookings...</div>
              </div> : <>
                <BookingFilters searchTerm={searchTerm} filterStatus={filterStatus} filterRegion={filterRegion} onSearchChange={setSearchTerm} onStatusChange={setFilterStatus} onRegionChange={setFilterRegion} />

                <BookingTable bookings={filteredBookings} onBookingUpdate={handleBookingUpdated} />
              </>}
          </CardContent>
        </Card>

        {/* Create Booking Modal */}
        {showCreateModal && <CreateBookingModal onClose={() => setShowCreateModal(false)} onBookingCreated={handleBookingCreated} />}
      </div>
    </AuthGuard>;
};
export default BookingsManager;