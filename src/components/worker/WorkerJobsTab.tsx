
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkerJobCard } from './WorkerJobCard';
import { User } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface WorkerJobsTabProps {
  jobs: any[];
  onStatusUpdate: (jobId: string, newStatus: BookingStatus) => void;
  onJobCancelled: () => void;
}

const WorkerJobsTab = ({ jobs, onStatusUpdate, onJobCancelled }: WorkerJobsTabProps) => {
  return (
    <Card className="bg-worker-card border-worker-border shadow-lg">
      <CardHeader className="bg-gradient-to-r from-worker-card to-worker-card-hover border-b border-worker-border">
        <CardTitle className="text-worker-card-foreground text-xl font-semibold">My Jobs</CardTitle>
        <p className="text-worker-muted text-sm">Manage your assigned jobs and track progress</p>
      </CardHeader>
      <CardContent className="p-6">
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-worker-border/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-worker-muted" />
            </div>
            <p className="text-worker-muted text-lg mb-2">No jobs assigned yet</p>
            <p className="text-worker-muted/70 text-sm">Check back later for new job assignments</p>
          </div>
        ) : (
          <div className="space-y-6">
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
