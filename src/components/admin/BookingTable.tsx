
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2 } from 'lucide-react';
import { EditBookingModal } from './EditBookingModal';
import { DeleteBookingModal } from './DeleteBookingModal';

interface Booking {
  id: string;
  customer?: { name?: string; region?: string };
  services: any;
  scheduled_at: string;
  worker?: { name?: string };
  status: string;
  total_price: number;
  customer_address: string;
}

interface BookingTableProps {
  bookings: Booking[];
  onBookingUpdate?: () => void;
}

export const BookingTable = ({ bookings, onBookingUpdate }: BookingTableProps) => {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatServices = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => s.name).join(', ');
    }
    return 'N/A';
  };

  const formatDuration = (services: any) => {
    if (Array.isArray(services)) {
      const totalMinutes = services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    return 'N/A';
  };

  const handleEdit = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowEditModal(true);
  };

  const handleDelete = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDeleteModal(true);
  };

  const handleModalClose = () => {
    setSelectedBooking(null);
    setShowEditModal(false);
    setShowDeleteModal(false);
  };

  const handleBookingUpdated = () => {
    if (onBookingUpdate) {
      onBookingUpdate();
    }
    handleModalClose();
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">{booking.id.slice(0, 8)}</TableCell>
                <TableCell>{booking.customer?.name || 'N/A'}</TableCell>
                <TableCell>{formatServices(booking.services)}</TableCell>
                <TableCell>
                  <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {formatDuration(booking.services)}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {new Date(booking.scheduled_at).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(booking.scheduled_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{booking.customer?.region || 'N/A'}</TableCell>
                <TableCell>{booking.worker?.name || 'Unassigned'}</TableCell>
                <TableCell>{getStatusBadge(booking.status)}</TableCell>
                <TableCell className="font-medium">${booking.total_price}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(booking)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(booking)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {bookings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No bookings found matching your criteria
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditBookingModal
        booking={selectedBooking}
        isOpen={showEditModal}
        onClose={handleModalClose}
        onBookingUpdated={handleBookingUpdated}
      />

      {/* Delete Modal */}
      <DeleteBookingModal
        booking={selectedBooking}
        isOpen={showDeleteModal}
        onClose={handleModalClose}
        onBookingDeleted={handleBookingUpdated}
      />
    </>
  );
};
