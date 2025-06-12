
import React from 'react';

const WorkerDashboardLoading = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading your dashboard...</p>
      </div>
    </div>
  );
};

export default WorkerDashboardLoading;
