
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CustomerDashboard = () => {
  const customerBookings = [
    {
      id: 'BK001',
      service: 'TV Mounting + Hide Cables',
      status: 'confirmed',
      date: '2024-12-15',
      time: '10:00 AM',
      address: '123 Main St, Downtown',
      worker: 'Alex Thompson',
      workerPhone: '(555) 111-2222',
      totalPrice: 149
    },
    {
      id: 'BK002',
      service: 'Furniture Assembly',
      status: 'completed',
      date: '2024-12-08',
      time: '2:00 PM',
      address: '123 Main St, Downtown',
      worker: 'Maria Garcia',
      workerPhone: '(555) 333-4444',
      totalPrice: 89
    },
    {
      id: 'BK003',
      service: 'TV Mounting',
      status: 'pending',
      date: '2024-12-20',
      time: '11:00 AM',
      address: '123 Main St, Downtown',
      worker: null,
      workerPhone: null,
      totalPrice: 99
    }
  ];

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
              <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
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
                    ${customerBookings.reduce((sum, b) => sum + b.totalPrice, 0)}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerDashboard;
