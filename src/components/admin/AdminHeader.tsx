import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowLeft, TestTube, Clock } from 'lucide-react';
import { useTestingMode } from '@/contexts/TestingModeContext';
import { useToast } from '@/hooks/use-toast';
import { AssignWorkerModal } from './AssignWorkerModal';
import { TodaysJobsModal } from './TodaysJobsModal';
export const AdminHeader = () => {
  const [showAssignWorker, setShowAssignWorker] = useState(false);
  const [showTodaysJobs, setShowTodaysJobs] = useState(false);
  const {
    isTestingMode,
    timeRemaining,
    activateTestingMode,
    deactivateTestingMode
  } = useTestingMode();
  const {
    toast
  } = useToast();
  const handleTestingModeToggle = () => {
    if (isTestingMode) {
      deactivateTestingMode();
      toast({
        title: "Testing Mode Disabled",
        description: "$75 minimum booking requirement restored."
      });
    } else {
      activateTestingMode();
      toast({
        title: "Testing Mode Enabled",
        description: "Minimum booking requirement bypassed for 10 minutes. You can now test with $1 bookings.",
        duration: 5000
      });
    }
  };
  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  return <>
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Site
              </Button>
            </Link>
            <div className="border-l border-gray-300 pl-4">
              <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
              <p className="text-gray-600">Manage your TV mounting business</p>
            </div>
          </div>
          <div className="flex space-x-3">
            
            <Button variant="outline" onClick={() => setShowTodaysJobs(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Today's Jobs
            </Button>
          </div>
        </div>
      </header>

      {showAssignWorker && <AssignWorkerModal onClose={() => setShowAssignWorker(false)} />}
      {showTodaysJobs && <TodaysJobsModal onClose={() => setShowTodaysJobs(false)} />}
    </>;
};