
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Calendar, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { useToast } from '@/hooks/use-toast';

export const BookingsManager = () => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="downtown">Downtown</SelectItem>
                <SelectItem value="north-side">North Side</SelectItem>
                <SelectItem value="west-end">West End</SelectItem>
                <SelectItem value="east-side">East Side</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                {filteredBookings.map((booking) => (
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
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredBookings.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No bookings found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
