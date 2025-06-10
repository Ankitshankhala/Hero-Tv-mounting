
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, DollarSign, Users } from 'lucide-react';

export const DashboardStats = () => {
  const stats = [
    {
      title: 'Total Revenue',
      value: '$12,460',
      description: '+20.1% from last month',
      icon: DollarSign,
      color: 'text-green-600',
    },
    {
      title: 'Bookings This Month',
      value: '156',
      description: '+12.5% from last month',
      icon: Calendar,
      color: 'text-blue-600',
    },
    {
      title: 'Active Customers',
      value: '1,234',
      description: '+8.2% from last month',
      icon: Users,
      color: 'text-purple-600',
    },
    {
      title: 'Jobs Completed',
      value: '142',
      description: '+5.3% from last month',
      icon: TrendingUp,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <p className="text-xs text-gray-600 mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>Latest bookings and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { customer: 'John Smith', service: 'TV Mounting + Hide Cables', time: '2:00 PM', status: 'Confirmed' },
                { customer: 'Sarah Johnson', service: 'TV Mounting', time: '4:00 PM', status: 'In Progress' },
                { customer: 'Mike Davis', service: 'TV Mounting + Hide Cables', time: '10:00 AM', status: 'Completed' },
              ].map((booking, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{booking.customer}</p>
                    <p className="text-sm text-gray-600">{booking.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{booking.time}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      booking.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      booking.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Workers and their assigned jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { worker: 'Alex Thompson', jobs: 3, region: 'Downtown', status: 'Active' },
                { worker: 'Maria Garcia', jobs: 2, region: 'North Side', status: 'Active' },
                { worker: 'David Lee', jobs: 4, region: 'West End', status: 'Busy' },
              ].map((worker, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{worker.worker}</p>
                    <p className="text-sm text-gray-600">{worker.region}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{worker.jobs} jobs</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      worker.status === 'Active' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {worker.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
