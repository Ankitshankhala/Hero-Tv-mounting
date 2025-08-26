
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { CreateBookingModal } from './CreateBookingModal';
import { EditBookingModal } from './EditBookingModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { useBookingManager } from '@/hooks/useBookingManager';
import { AuthGuard } from '@/components/AuthGuard';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';


export const BookingsManager = () => {
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [archiveFilter, setArchiveFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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
      // All non-archived bookings except pending payments
      filtered = filtered.filter(booking => 
        !booking.is_archived && 
        !(booking.payment_status === 'pending' || !booking.payment_status || booking.payment_status === 'failed')
      );
    } else if (archiveFilter === 'pending_payments') {
      // Only bookings with pending/missing payment authorization
      filtered = filtered.filter(booking => 
        !booking.is_archived && 
        (booking.payment_status === 'pending' || !booking.payment_status || booking.payment_status === 'failed')
      );
      // Sort by newest first for pending payments
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
    fetchBookings();
  };

  const handleBookingUpdated = () => {
    console.log('Booking updated from BookingTable, refreshing list');
    fetchBookings();
  };

  // Handler implementations for BookingTable
  const handleEditBooking = (booking: any) => {
    console.log('Edit booking:', booking);
    setSelectedBooking(booking);
    setShowEditModal(true);
  };

  const handleDeleteBooking = async (booking: any) => {
    console.log('Delete booking:', booking);
    if (window.confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      try {
        const { error } = await supabase
          .from('bookings')
          .delete()
          .eq('id', booking.id);
        
        if (error) throw error;
        
        toast({
          title: "Booking Deleted",
          description: "The booking has been successfully deleted.",
        });
        
        fetchBookings(); // Refresh the list
      } catch (error) {
        console.error('Failed to delete booking:', error);
        toast({
          title: "Delete Failed",
          description: "Failed to delete the booking. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleViewBooking = (booking: any) => {
    console.log('View booking:', booking);
    setSelectedBooking(booking);
    setShowEditModal(true); // For now, use edit modal for viewing
  };

  const handleAssignWorker = (booking: any) => {
    console.log('Assign worker to booking:', booking);
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
                  showPendingPaymentActions={archiveFilter === 'pending_payments'}
                  onSendReminder={handleSendReminder}
                  onCancelBooking={handleCancelBooking}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Modals */}
        {showCreateModal && (
          <CreateBookingModal 
            onClose={() => setShowCreateModal(false)} 
            onBookingCreated={handleBookingCreated} 
          />
        )}
        
        {showEditModal && selectedBooking && (
          <EditBookingModal
            booking={selectedBooking}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedBooking(null);
            }}
            onBookingUpdated={() => {
              handleBookingUpdated();
              setShowEditModal(false);
              setSelectedBooking(null);
            }}
          />
        )}
        
        {showAssignModal && selectedBooking && (
          <AssignWorkerModal
            onClose={() => {
              setShowAssignModal(false);
              setSelectedBooking(null);
            }}
            onAssignmentComplete={() => {
              handleBookingUpdated();
              setShowAssignModal(false);
              setSelectedBooking(null);
            }}
            selectedBookingId={selectedBooking.id}
            isOpen={showAssignModal}
          />
        )}
      </div>
    </AuthGuard>
  );
};

export default BookingsManager;
