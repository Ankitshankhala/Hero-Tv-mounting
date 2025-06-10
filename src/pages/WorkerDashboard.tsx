
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, Phone, User, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WorkerDashboard = () => {
  const [selectedStatus, setSelectedStatus] = useState('');

  const workerJobs = [
    {
      id: 'BK001',
      customer: 'John Smith',
      customerPhone: '(555) 123-4567',
      service: 'TV Mounting + Hide Cables',
      status: 'confirmed',
      date: '2024-12-15',
      time: '10:00 AM',
      address: '123 Main St, Downtown',
      duration: '1hr 30min',
      price: 149,
      specialInstructions: 'Please call when arriving, apartment buzzer is broken'
    },
    {
      id: 'BK004',
      customer: 'Emily Wilson',
      customerPhone: '(555) 987-6543',
      service: 'Furniture Assembly',
      status: 'in_progress',
      date: '2024-12-14',
      time: '2:00 PM',
      address: '456 Oak Ave, North Side',
      duration: '1hr',
      price: 89,
      specialInstructions: null
    },
    {
      id: 'BK007',
      customer: 'Mike Davis',
      customerPhone: '(555) 555-7890',
      service: 'TV Mounting',
      status: 'confirmed',
      date: '2024-12-16',
      time: '11:00 AM',
      address: '789 Pine St, West End',
      duration: '1hr 15min',
      price: 99,
      specialInstructions: null
    }
  ];

  const updateJobStatus = (jobId: string, newStatus: string) => {
    console.log(`Updating job ${jobId} to ${newStatus}`);
    // TODO: Integrate with Supabase
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const todaysJobs = workerJobs.filter(job => job.date === '2024-12-14');
  const upcomingJobs = workerJobs.filter(job => job.date > '2024-12-14');

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
                <h1 className="text-2xl font-bold text-white">Worker Dashboard</h1>
                <p className="text-slate-300">Alex Thompson</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-400">Today's Date</p>
              <p className="text-white font-medium">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400">Today's Jobs</p>
                  <p className="text-2xl font-bold text-white">{todaysJobs.length}</p>
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
                  <p className="text-2xl font-bold text-white">{upcomingJobs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-slate-400">Completed</p>
                  <p className="text-2xl font-bold text-white">
                    {workerJobs.filter(j => j.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">$</span>
                </div>
                <div>
                  <p className="text-slate-400">Today's Earnings</p>
                  <p className="text-2xl font-bold text-white">
                    ${todaysJobs.reduce((sum, job) => sum + job.price, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">My Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workerJobs.map((job) => (
                <Card key={job.id} className="bg-slate-700 border-slate-600">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{job.customer}</h3>
                        <p className="text-slate-400">Job #{job.id} • {job.service}</p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(job.status)}
                        <p className="text-xl font-bold text-white mt-1">${job.price}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Calendar className="h-4 w-4" />
                        <span>{job.date} at {job.time}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Clock className="h-4 w-4" />
                        <span>{job.duration}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Phone className="h-4 w-4" />
                        <span>{job.customerPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2 mb-4 text-slate-300">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span>{job.address}</span>
                    </div>

                    {job.specialInstructions && (
                      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mb-4">
                        <p className="text-yellow-200 text-sm">
                          <strong>Special Instructions:</strong> {job.specialInstructions}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-slate-600">
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          Call Customer
                        </Button>
                        <Button size="sm" variant="outline">
                          Get Directions
                        </Button>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 text-sm">Update Status:</span>
                        <Select onValueChange={(value) => updateJobStatus(job.id, value)}>
                          <SelectTrigger className="w-40 bg-slate-600 border-slate-500">
                            <SelectValue placeholder="Update status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
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

export default WorkerDashboard;
