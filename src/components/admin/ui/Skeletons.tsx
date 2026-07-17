import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const TableSkeleton = ({ rows = 6, cols = 5, className }: { rows?: number; cols?: number; className?: string }) => (
  <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
    <div className="border-b border-border bg-muted/50 px-4 py-3 flex gap-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="border-b border-border last:border-0 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ className }: { className?: string }) => (
  <Card className={cn('p-5', className)}>
    <Skeleton className="h-3 w-24 mb-3" />
    <Skeleton className="h-7 w-32 mb-2" />
    <Skeleton className="h-3 w-20" />
  </Card>
);
