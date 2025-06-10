
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WorkerJobCard from './WorkerJobCard';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface WorkerJobsTabProps {
  jobs: any[];
  onStatusUpdate: (jobId: string, newStatus: BookingStatus) => void;
  onJobCancelled: () => void;
}

const WorkerJobsTab = ({ jobs, onStatusUpdate, onJobCancelled }: WorkerJobsTabProps) => {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">My Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">No jobs assigned yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <WorkerJobCard
                key={job.id}
                job={job}
                onStatusUpdate={onStatusUpdate}
                onJobCancelled={onJobCancelled}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkerJobsTab;
