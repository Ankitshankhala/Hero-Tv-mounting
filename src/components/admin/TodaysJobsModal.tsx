
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Clock, MapPin, User, Phone } from 'lucide-react';

interface TodaysJobsModalProps {
  onClose: () => void;
}

export const TodaysJobsModal = ({ onClose }: TodaysJobsModalProps) => {
  const todaysJobs = [
    {
      id: 'BK001',
      time: '9:00 AM',
      customer: 'John Smith',
      service: 'TV Mounting + Hide Cables',
      address: '123 Main St, Downtown',
      worker: 'Alex Thompson',
      workerPhone: '(555) 111-2222',
      status: 'confirmed',
      duration: '1hr 30min'
    },
    {
      id: 'BK002',
      time: '11:00 AM',
      customer: 'Sarah Johnson',
      service: 'TV Mounting',
      address: '456 Oak Ave, North Side',
      worker: 'Maria Garcia',
      workerPhone: '(555) 333-4444',
      status: 'in-progress',
      duration: '1hr 15min'
    },
    {
      id: 'BK003',
      time: '2:00 PM',
      customer: 'Mike Davis',
      service: 'Sound Bar Installation',
      address: '789 Pine St, West End',
      worker: 'David Lee',
      workerPhone: '(555) 555-6666',
      status: 'confirmed',
      duration: '1hr'
    },
    {
      id: 'BK004',
      time: '4:00 PM',
      customer: 'Emily Wilson',
      service: 'TV Mounting + Hide Cables',
      address: '321 Elm St, East Side',
      worker: 'Alex Thompson',
      workerPhone: '(555) 111-2222',
      status: 'confirmed',
      duration: '1hr 30min'
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in-progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Today's Jobs</h2>
            <p className="text-gray-600">{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {todaysJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{job.customer}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-600">{job.time}</span>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {job.duration}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-600">{job.id}</span>
                    <div className="mt-1">{getStatusBadge(job.status)}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium text-gray-900">{job.service}</p>
                </div>
                
                <div className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                  <span className="text-sm text-gray-600">{job.address}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">{job.worker}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">{job.workerPhone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
