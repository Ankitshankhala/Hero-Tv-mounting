
import React from 'react';
import { Calendar, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface WorkerDashboardStatsProps {
  todaysJobs: number;
  upcomingJobs: number;
  completedJobs: number;
  todaysEarnings: number;
}

const WorkerDashboardStats = ({ 
  todaysJobs, 
  upcomingJobs, 
  completedJobs, 
  todaysEarnings 
}: WorkerDashboardStatsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-slate-400">Today's Jobs</p>
              <p className="text-2xl font-bold text-white">{todaysJobs}</p>
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
              <p className="text-2xl font-bold text-white">{upcomingJobs}</p>
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
              <p className="text-2xl font-bold text-white">{completedJobs}</p>
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
              <p className="text-2xl font-bold text-white">${todaysEarnings}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerDashboardStats;
