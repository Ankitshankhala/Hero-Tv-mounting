
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, Clock, DollarSign } from 'lucide-react';

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
  const stats = [
    {
      title: "Today's Jobs",
      value: todaysJobs,
      icon: Calendar,
      color: "text-blue-400"
    },
    {
      title: "Upcoming Jobs",
      value: upcomingJobs,
      icon: Clock,
      color: "text-orange-400"
    },
    {
      title: "Completed Jobs",
      value: completedJobs,
      icon: CheckCircle,
      color: "text-green-400"
    },
    {
      title: "Today's Earnings",
      value: `$${todaysEarnings.toFixed(2)}`,
      icon: DollarSign,
      color: "text-yellow-400"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WorkerDashboardStats;
