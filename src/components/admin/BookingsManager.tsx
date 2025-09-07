
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { CreateBookingModal } from './CreateBookingModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { EditBookingModal } from './EditBookingModal';
import { BookingDetailsModal } from './BookingDetailsModal';
import { DeleteBookingModal } from './DeleteBookingModal';
import { useBookingManager } from '@/hooks/useBookingManager';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';


export const BookingsManager = () => {
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [archiveFilter, setArchiveFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const { user } = useAuth();

  // Use our enhanced booking manager hook
  const { 
    bookings, 
    loading, 
    enriching,
    handleBookingUpdate, 
    fetchBookings 
  } = useBookingManager();

  // Set up real-time subscriptions for admin with enhanced callback
  const handleRealtimeUpdate = React.useCallback((updatedBooking: any) => {
    console.log('Real-time booking update received in BookingsManager:', updatedBooking);
    handleBookingUpdate(updatedBooking);
  }, [handleBookingUpdate]);

  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: handleRealtimeUpdate
  });

  useEffect(() => {
    // Apply filters
    let filtered = bookings;
    
    // Archive and payment status filter
    if (archiveFilter === 'active') {
      // All non-archived bookings (including new ones with pending payments)
      filtered = filtered.filter(booking => !booking.is_archived);
    } else if (archiveFilter === 'pending_payments') {
      // Only bookings with pending/missing payment authorization
      filtered = filtered.filter(booking => 
        !booking.is_archived && 
        (booking.payment_status === 'pending' || booking.payment_status === 'payment_pending' || !booking.payment_status || booking.payment_status === 'failed')
      );
      // Sort by newest first for pending payments
      filtered = filtered.sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      });
    } else if (archiveFilter === 'authorized_unassigned') {
      // Only bookings that are authorized but don't have a worker assigned
      filtered = filtered.filter(booking => 
        !booking.is_archived && 
        (booking.payment_status === 'authorized' || booking.status === 'pending') &&
        !booking.worker_id
      );
      // Sort by newest first for urgent assignment
      filtered = filtered.sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      });
    } else if (archiveFilter === 'archived') {
      filtered = filtered.filter(booking => booking.is_archived);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(booking => booking.status === filterStatus);
    }
    if (filterRegion !== 'all') {
      filtered = filtered.filter(booking => booking.customer?.region?.toLowerCase() === filterRegion.toLowerCase());
    }
    if (searchTerm) {
      filtered = filtered.filter(booking => 
        booking.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        booking.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        booking.services?.some(service => service.name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
        booking.worker?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredBookings(filtered);
  }, [bookings, filterStatus, filterRegion, archiveFilter, searchTerm]);

  const handleBookingCreated = () => {
    console.log('Booking created, refreshing list');
    fetchBookings(true); // Bypass cache to get fresh data
    
    // Also refresh after a short delay to ensure database consistency
    setTimeout(() => {
      console.log('Secondary refresh after booking creation');
      fetchBookings(true);
    }, 1000);
  };

  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    fetchBookings(true); // Bypass cache for manual refresh
  };

  const handleBookingUpdated = () => {
    console.log('Booking updated from BookingTable, refreshing list');
    fetchBookings();
  };

  const handleEditBooking = (booking: any) => {
    setSelectedBooking(booking);
    setShowEditModal(true);
  };

  const handleDeleteBooking = (booking: any) => {
    setSelectedBooking(booking);
    setShowDeleteModal(true);
  };

  const handleViewBooking = (booking: any) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const handleAssignWorker = (booking: any) => {
    setSelectedBooking(booking);
    setShowAssignModal(true);
  };

  const handleSendReminder = async (booking: any) => {
    console.log('Send payment reminder for booking:', booking);
    // TODO: Implement send reminder functionality
    try {
      // Call the payment reminder edge function or notification system
      console.log('Payment reminder sent for booking:', booking.id);
    } catch (error) {
      console.error('Failed to send payment reminder:', error);
    }
  };

  const handleCancelBooking = async (booking: any) => {
    console.log('Cancel booking:', booking);
    // TODO: Implement cancel booking functionality
    try {
      // Update booking status to cancelled
      console.log('Booking cancelled:', booking.id);
      fetchBookings(); // Refresh the list
    } catch (error) {
      console.error('Failed to cancel booking:', error);
    }
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
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
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
                  archiveFilter={archiveFilter}
                  onSearchChange={setSearchTerm}
                  onStatusChange={setFilterStatus}
                  onRegionChange={setFilterRegion}
                  onArchiveFilterChange={setArchiveFilter}
                />

                <BookingTable 
                  bookings={filteredBookings} 
                  onBookingUpdate={handleBookingUpdated}
                  onEditBooking={handleEditBooking}
                  onDeleteBooking={handleDeleteBooking}
                  onViewBooking={handleViewBooking}
                  onAssignWorker={handleAssignWorker}
                  loading={loading}
                  enriching={enriching}
                  showPendingPaymentActions={archiveFilter === 'pending_payments'}
                  onSendReminder={handleSendReminder}
                  onCancelBooking={handleCancelBooking}
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

        {/* Assign Worker Modal */}
        {showAssignModal && selectedBooking && (
          <AssignWorkerModal 
            isOpen={showAssignModal}
            selectedBookingId={selectedBooking.id}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedBooking(null);
            }} 
            onAssignmentComplete={fetchBookings}
          />
        )}

        {/* Edit Booking Modal */}
        {showEditModal && selectedBooking && (
          <EditBookingModal
            booking={selectedBooking}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedBooking(null);
            }}
            onBookingUpdated={fetchBookings}
          />
        )}

        {/* Booking Details Modal */}
        {showDetailsModal && selectedBooking && (
          <BookingDetailsModal
            booking={selectedBooking}
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedBooking(null);
            }}
          />
        )}

        {/* Delete Booking Modal */}
        {showDeleteModal && selectedBooking && (
          <DeleteBookingModal
            booking={selectedBooking}
            isOpen={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedBooking(null);
            }}
            onBookingDeleted={fetchBookings}
          />
        )}
      </div>
    </AuthGuard>
  );
};

export default BookingsManager;
