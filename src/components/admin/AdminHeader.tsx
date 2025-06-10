
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, Calendar, ArrowLeft } from 'lucide-react';
import { CreateBookingModal } from './CreateBookingModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { TodaysJobsModal } from './TodaysJobsModal';

export const AdminHeader = () => {
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showAssignWorker, setShowAssignWorker] = useState(false);
  const [showTodaysJobs, setShowTodaysJobs] = useState(false);

  const handleWorkerAssignment = (bookingId: string, workerId: string) => {
    console.log('Worker assigned:', { bookingId, workerId });
    // Optionally refresh data or show success message
  };

  return (
    <>
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
            <Button 
              onClick={() => setShowCreateBooking(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Booking
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowAssignWorker(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Worker
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowTodaysJobs(true)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Today's Jobs
            </Button>
          </div>
        </div>
      </header>

      {showCreateBooking && (
        <CreateBookingModal onClose={() => setShowCreateBooking(false)} />
      )}
      {showAssignWorker && (
        <AssignWorkerModal 
          isOpen={showAssignWorker}
          onClose={() => setShowAssignWorker(false)}
          booking={null}
          onAssign={handleWorkerAssignment}
        />
      )}
      {showTodaysJobs && (
        <TodaysJobsModal onClose={() => setShowTodaysJobs(false)} />
      )}
    </>
  );
};
