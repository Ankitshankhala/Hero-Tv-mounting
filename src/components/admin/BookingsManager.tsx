
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBookingManager } from '@/hooks/useBookingManager';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { AuthGuard } from '@/components/AuthGuard';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { CreateBookingModal } from './CreateBookingModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { EditBookingModal } from './EditBookingModal';
import { BookingDetailsModal } from './BookingDetailsModal';
import { DeleteBookingModal } from './DeleteBookingModal';
import { Button } from '@/components/ui/button';
import { RefreshCw, Archive, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/admin/ui/PageHeader';
import { TableSkeleton } from '@/components/admin/ui/Skeletons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const BookingsManager = () => {
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  // Default to 'new_bookings' tab
  const [archiveFilter, setArchiveFilter] = useState('new_bookings');
  const [searchTerm, setSearchTerm] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [deletingPending, setDeletingPending] = useState(false);
  const { user } = useAuth();

  // Use our enhanced booking manager hook
  const {
    bookings,
    loading,
    enriching,
    hasMore,
    handleBookingUpdate,
    fetchBookings,
    loadMoreArchived,
  } = useBookingManager();

  const [loadingMore, setLoadingMore] = useState(false);

  // Re-fetch when tab or includeArchived changes
  useEffect(() => {
    fetchBookings({
      view: archiveFilter as any,
      includeArchived,
      bypassCache: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveFilter, includeArchived]);

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

    // Server-side already filtered by is_archived + payment_status per tab.
    // Only apply lightweight client-side refinements below.




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
  }, [bookings, filterStatus, filterRegion, archiveFilter, searchTerm, includeArchived]);

  const refetchCurrentView = (bypassCache = true) =>
    fetchBookings({
      view: archiveFilter as any,
      includeArchived,
      bypassCache,
    });

  const handleBookingCreated = () => {
    console.log('Booking created, refreshing list');
    refetchCurrentView(true);
    setTimeout(() => {
      console.log('Secondary refresh after booking creation');
      refetchCurrentView(true);
    }, 1000);
  };

  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    refetchCurrentView(true);
  };

  const handleBookingUpdated = () => {
    console.log('Booking updated from BookingTable, refreshing list');
    refetchCurrentView(false);
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

  const handleBulkArchive = async () => {
    if (selectedBookingIds.length === 0) {
      toast.error('Please select bookings to archive');
      return;
    }

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          is_archived: true, 
          archived_at: new Date().toISOString() 
        })
        .in('id', selectedBookingIds);

      if (error) throw error;

      toast.success(`Archived ${selectedBookingIds.length} booking${selectedBookingIds.length > 1 ? 's' : ''}`);
      setSelectedBookingIds([]);
      fetchBookings(true);
    } catch (error) {
      console.error('Bulk archive failed:', error);
      toast.error('Failed to archive bookings');
    }
  };

  const handleSelectBooking = (bookingId: string, checked: boolean) => {
    setSelectedBookingIds(prev => 
      checked 
        ? [...prev, bookingId]
        : prev.filter(id => id !== bookingId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedBookingIds(
      checked ? filteredBookings.map((b: any) => b.id) : []
    );
  };

  const handleBulkDeletePaymentPending = async () => {
    setDeletingPending(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-delete-payment-pending');

      if (error) throw error;

      if (data.success) {
        toast.success(`Deleted ${data.deleted_count} payment_pending bookings`);
        if (data.failed_count > 0) {
          toast.warning(`${data.failed_count} bookings failed to delete`);
        }
        fetchBookings(true);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      toast.error(`Failed to delete bookings: ${error.message}`);
    } finally {
      setDeletingPending(false);
    }
  };

  // Count payment_pending bookings for the button
  const paymentPendingCount = bookings.filter(
    (b: any) => b.status === 'payment_pending'
  ).length;

  return (
    <AuthGuard allowedRoles={['admin']}>
      <PageHeader
        title="Bookings"
        subtitle="Manage bookings, assignments, and archive"
        actions={
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="text-xs text-[hsl(var(--action-success))]">● Live</span>
            )}
            {archiveFilter !== 'archived' && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  checked={includeArchived}
                  onChange={(e) => {
                    setIncludeArchived(e.target.checked);
                    setSelectedBookingIds([]);
                  }}
                />
                Include archived
              </label>
            )}
            {selectedBookingIds.length > 0 && (
              <Button variant="default" size="sm" onClick={handleBulkArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive ({selectedBookingIds.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <Card className="p-4 border-border shadow-sm">
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
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
              showPendingPaymentActions={false}
              onSendReminder={handleSendReminder}
              onCancelBooking={handleCancelBooking}
              selectedBookingIds={selectedBookingIds}
              onSelectBooking={handleSelectBooking}
              onSelectAll={handleSelectAll}
              showBulkActions={archiveFilter === 'new_bookings'}
            />

            {archiveFilter === 'archived' && hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingMore || enriching}
                  onClick={async () => {
                    setLoadingMore(true);
                    try {
                      await loadMoreArchived();
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more archived'}
                </Button>
              </div>
            )}
          </>
        )}
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
    </AuthGuard>
  );
};

export default BookingsManager;
