import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/hooks/useImpersonation';
import { formatDistanceToNow } from 'date-fns';

export const ImpersonationBanner = () => {
  const { activeSession, endImpersonation, loading } = useImpersonation();

  if (!activeSession) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-3 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-medium">
              Admin Impersonation Mode
            </p>
            <p className="text-sm opacity-90">
              Viewing as {activeSession.worker_name || activeSession.worker_email} • 
              Started {formatDistanceToNow(new Date(activeSession.started_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={endImpersonation}
          disabled={loading}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Exit Impersonation
        </Button>
      </div>
    </div>
  );
};
