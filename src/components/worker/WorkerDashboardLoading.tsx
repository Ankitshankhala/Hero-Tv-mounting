
import React from 'react';

const WorkerDashboardLoading = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-4 text-white">Loading your jobs...</p>
      </div>
    </div>
  );
};

export default WorkerDashboardLoading;
