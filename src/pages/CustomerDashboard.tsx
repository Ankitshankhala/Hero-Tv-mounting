import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, Plus, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PendingModifications } from '@/components/customer/PendingModifications';
import { useNavigate } from 'react-router-dom';

const CustomerDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchBookings = async () => {
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
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load your bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getServicesDisplay = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => `${s.name} (${s.quantity})`).join(', ');
    }
    return 'Service details';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-600">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {profile?.name || 'Customer'}!</h1>
          <p className="text-gray-600 mt-2">Manage your bookings and services</p>
        </div>
        <Button onClick={() => navigate('/book')} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Book New Service</span>
        </Button>
      </div>

      <div className="space-y-6">
        {/* Pending Modifications Section */}
        <PendingModifications />

        {/* Bookings Section */}
        <Card>
          <CardHeader>
            <CardTitle>Your Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No bookings yet</p>
                <Button onClick={() => navigate('/book')}>
                  Book Your First Service
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const { date, time } = formatDateTime(booking.scheduled_at);
                  
                  return (
                    <Card key={booking.id} className="border-gray-200">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-lg">
                                #{booking.id.slice(0, 8)}
                              </span>
                              {getStatusBadge(booking.status)}
                              {booking.has_modifications && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                  Modified
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center space-x-4 text-gray-600">
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{date}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{time}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-1 text-gray-600">
                                <MapPin className="h-4 w-4" />
                                <span className="truncate">{booking.customer_address}</span>
                              </div>
                              
                              <p className="text-gray-700">
                                <strong>Services:</strong> {getServicesDisplay(booking.services)}
                              </p>
                              
                              {booking.worker && (
                                <p className="text-gray-700">
                                  <strong>Technician:</strong> {booking.worker.name}
                                </p>
                              )}
                              
                              {booking.special_instructions && (
                                <p className="text-gray-700">
                                  <strong>Instructions:</strong> {booking.special_instructions}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right space-y-2">
                            <div className="text-2xl font-bold text-green-600">
                              ${booking.total_price}
                            </div>
                            {booking.pending_payment_amount && booking.pending_payment_amount !== 0 && (
                              <div className={`text-sm font-medium ${
                                booking.pending_payment_amount > 0 ? 'text-orange-600' : 'text-green-600'
                              }`}>
                                Pending: {booking.pending_payment_amount > 0 ? '+' : ''}${booking.pending_payment_amount}
                              </div>
                            )}
                            {booking.status === 'completed' && (
                              <Button size="sm" variant="outline" className="flex items-center space-x-1">
                                <Star className="h-3 w-3" />
                                <span>Leave Review</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerDashboard;
