import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, Clock, DollarSign, Trophy } from 'lucide-react';
import { formatCurrency } from '@/utils/workerEarningsCalculator';

interface WorkerDashboardStatsProps {
  todaysJobs: number;
  upcomingJobs: number;
  completedJobs: number;
  todaysEarnings: number;
  totalTips: number;
}

const WorkerDashboardStats = ({ 
  todaysJobs, 
  upcomingJobs, 
  completedJobs, 
  todaysEarnings,
  totalTips 
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
      value: formatCurrency(todaysEarnings),
      icon: DollarSign,
      color: "text-yellow-400"
    },
    {
      title: "Total Tips Earned",
      value: formatCurrency(totalTips),
      icon: Trophy,
      color: "text-purple-400"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-slate-300">
                {stat.title}
              </CardTitle>
              <Icon className={`h-3 w-3 ${stat.color}`} />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WorkerDashboardStats;
