
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { useToast } from '@/hooks/use-toast';
import GoogleCalendarIntegration from '@/components/GoogleCalendarIntegration';
import { BookingFilters } from './BookingFilters';
import { BookingTable } from './BookingTable';
import { BookingCalendarSyncList } from './BookingCalendarSyncList';

export const BookingsManager = () => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Set up real-time subscriptions for admin
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: (updatedBooking) => {
      setBookings(currentBookings => {
        const existingBookingIndex = currentBookings.findIndex(booking => booking.id === updatedBooking.id);
        
        if (existingBookingIndex >= 0) {
          // Update existing booking
          const updatedBookings = [...currentBookings];
          updatedBookings[existingBookingIndex] = { ...updatedBookings[existingBookingIndex], ...updatedBooking };
          return updatedBookings;
        } else {
          // Add new booking
          fetchBookings(); // Refetch to get complete data with relations
          return currentBookings;
        }
      });
    }
  });

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
            {isConnected && (
              <span className="text-sm text-green-600">● Live updates enabled</span>
            )}
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
