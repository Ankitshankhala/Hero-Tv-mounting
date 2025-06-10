
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkerDashboardHeaderProps {
  workerName: string;
}

const WorkerDashboardHeader = ({ workerName }: WorkerDashboardHeaderProps) => {
  return (
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
              <p className="text-slate-300">{workerName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-slate-400">Today's Date</p>
            <p className="text-white font-medium">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default WorkerDashboardHeader;
