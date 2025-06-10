import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';
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
  const { syncBookingToCalendar, isCalendarConnected: calendarConnected } = useBookingCalendarSync();

  // Set up real-time subscriptions for admin
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'admin',
    onBookingUpdate: async (updatedBooking) => {
      console.log('Real-time booking update received:', updatedBooking);
      
      setBookings(currentBookings => {
        const existingBookingIndex = currentBookings.findIndex(booking => booking.id === updatedBooking.id);
        let updatedBookings = [...currentBookings];
        
        if (existingBookingIndex >= 0) {
          const oldBooking = currentBookings[existingBookingIndex];
          updatedBookings[existingBookingIndex] = { ...oldBooking, ...updatedBooking };
          
          // Handle calendar sync for real-time updates if calendar is connected
          if (isCalendarConnected) {
            const bookingData = updatedBookings[existingBookingIndex];
            
            // Determine if this is a status change that needs calendar sync
            if (oldBooking.status !== updatedBooking.status) {
              // Use setTimeout to handle async operations without blocking the state update
              setTimeout(async () => {
                try {
                  if (updatedBooking.status === 'cancelled') {
                    // Delete from calendar
                    await syncBookingToCalendar(bookingData, 'delete');
                  } else if (oldBooking.status === 'pending' && updatedBooking.status === 'confirmed') {
                    // Create calendar event
                    await syncBookingToCalendar(bookingData, 'create');
                  } else {
                    // Update existing calendar event
                    await syncBookingToCalendar(bookingData, 'update');
                  }
                } catch (error) {
                  console.error('Error syncing calendar for real-time update:', error);
                }
              }, 0);
            }
          }
        } else {
          // Add new booking and sync to calendar if connected
          updatedBookings.unshift(updatedBooking);
          fetchBookings(); // Refetch to get complete data with relations
          
          if (isCalendarConnected && updatedBooking.status !== 'cancelled') {
            // Use setTimeout to handle async operations without blocking the state update
            setTimeout(async () => {
              try {
                await syncBookingToCalendar(updatedBooking, 'create');
              } catch (error) {
                console.error('Error syncing new booking to calendar:', error);
              }
            }, 0);
          }
        }
        
        return updatedBookings;
      });
    }
  });

  // Update calendar connection state
  useEffect(() => {
    setIsCalendarConnected(calendarConnected);
  }, [calendarConnected]);

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

export default BookingsManager;
