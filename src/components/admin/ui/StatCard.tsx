import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  className?: string;
}

export const StatCard = ({ label, value, delta, deltaLabel, icon: Icon, className }: Props) => {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className={cn('p-5 border-border shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
          {delta !== undefined && (
            <div className={cn(
              'mt-2 inline-flex items-center gap-1 text-xs font-medium',
              positive ? 'text-[hsl(var(--action-success))]' : 'text-[hsl(var(--action-danger))]'
            )}>
              {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(delta)}%{deltaLabel && <span className="text-muted-foreground font-normal ml-1">{deltaLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="h-9 w-9 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </Card>
  );
};
