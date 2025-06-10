import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeBookings } from '@/hooks/useRealtimeBookings';
import { useToast } from '@/hooks/use-toast';

const CustomerDashboard = () => {
  const [customerBookings, setCustomerBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Set up real-time subscriptions
  const { isConnected } = useRealtimeBookings({
    userId: user?.id,
    userRole: 'customer',
    onBookingUpdate: (updatedBooking) => {
      setCustomerBookings(currentBookings => {
        const existingBookingIndex = currentBookings.findIndex(booking => booking.id === updatedBooking.id);
        
        if (existingBookingIndex >= 0) {
          // Update existing booking
          const updatedBookings = [...currentBookings];
          updatedBookings[existingBookingIndex] = { ...updatedBookings[existingBookingIndex], ...updatedBooking };
          return updatedBookings;
        } else if (updatedBooking.customer_id === user?.id) {
          // Add new booking if it belongs to this customer
          fetchCustomerBookings(); // Refetch to get complete data with relations
          return currentBookings;
        }
        
        return currentBookings;
      });
    }
  });

  useEffect(() => {
    if (user) {
      fetchCustomerBookings();
    }
  }, [user]);

  const fetchCustomerBookings = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          worker:users!worker_id(name, phone)
        `)
        .eq('customer_id', user.id)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match the expected format
      const transformedBookings = data?.map(booking => {
        // Parse services JSON safely
        let serviceNames = 'Service';
        try {
          const services = booking.services;
          if (Array.isArray(services)) {
            serviceNames = services.map(s => {
              if (typeof s === 'object' && s !== null && 'name' in s) {
                return String(s.name);
              }
              return 'Service';
            }).join(', ');
          } else if (typeof services === 'object' && services !== null && 'name' in services) {
            serviceNames = String(services.name);
          }
        } catch (e) {
          console.error('Error parsing services:', e);
        }

        return {
          id: booking.id,
          service: serviceNames,
          status: booking.status,
          date: new Date(booking.scheduled_at).toLocaleDateString(),
          time: new Date(booking.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          address: booking.customer_address,
          worker: booking.worker?.name || null,
          workerPhone: booking.worker?.phone || null,
          totalPrice: booking.total_price
        };
      }) || [];

      setCustomerBookings(transformedBookings);
    } catch (error) {
      console.error('Error fetching customer bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load your bookings",
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
      'in_progress': { label: 'In Progress', variant: 'default' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading your bookings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="ghost" className="text-white hover:text-blue-400">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
                {isConnected && (
                  <p className="text-sm text-green-400">● Live updates enabled</p>
                )}
              </div>
            </div>
            <Link to="/book">
              <Button>Book New Service</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome back!</h2>
          <p className="text-slate-300">Here are your recent bookings and upcoming appointments.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400">Total Bookings</p>
                  <p className="text-2xl font-bold text-white">{customerBookings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400">Upcoming</p>
                  <p className="text-2xl font-bold text-white">
                    {customerBookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">$</span>
                </div>
                <div>
                  <p className="text-slate-400">Total Spent</p>
                  <p className="text-2xl font-bold text-white">
                    ${customerBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">My Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {customerBookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400">No bookings yet</p>
                <Link to="/book">
                  <Button className="mt-4">Book Your First Service</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {customerBookings.map((booking) => (
                  <Card key={booking.id} className="bg-slate-700 border-slate-600">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{booking.service}</h3>
                          <p className="text-slate-400">Booking #{booking.id}</p>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(booking.status)}
                          <p className="text-xl font-bold text-white mt-1">${booking.totalPrice}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center space-x-2 text-slate-300">
                          <Calendar className="h-4 w-4" />
                          <span>{booking.date} at {booking.time}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-300">
                          <MapPin className="h-4 w-4" />
                          <span>{booking.address}</span>
                        </div>
                      </div>

                      {booking.worker && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-600">
                          <div className="flex items-center space-x-2 text-slate-300">
                            <User className="h-4 w-4" />
                            <span>Assigned to: <span className="text-white font-medium">{booking.worker}</span></span>
                          </div>
                          <div className="flex items-center space-x-2 text-slate-300">
                            <Phone className="h-4 w-4" />
                            <span>{booking.workerPhone}</span>
                          </div>
                        </div>
                      )}

                      {!booking.worker && booking.status === 'pending' && (
                        <div className="pt-4 border-t border-slate-600">
                          <p className="text-yellow-400 text-sm">
                            ⏳ Worker assignment pending - we'll notify you once assigned
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerDashboard;
