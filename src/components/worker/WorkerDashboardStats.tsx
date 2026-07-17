import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  totalTips,
}: WorkerDashboardStatsProps) => {
  const stats = [
    { title: "Today's Jobs", value: todaysJobs, icon: Calendar },
    { title: 'Upcoming Jobs', value: upcomingJobs, icon: Clock },
    { title: 'Completed Jobs', value: completedJobs, icon: CheckCircle },
    { title: "Today's Earnings", value: formatCurrency(todaysEarnings), icon: DollarSign },
    { title: 'Total Tips Earned', value: formatCurrency(totalTips), icon: Trophy },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="bg-card border border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.title}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WorkerDashboardStats;
