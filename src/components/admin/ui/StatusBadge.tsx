import React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'pending' | 'confirmed' | 'progress' | 'completed' | 'cancelled' | 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const MAP: Record<string, Variant> = {
  pending: 'pending',
  scheduled: 'confirmed',
  confirmed: 'confirmed',
  authorized: 'confirmed',
  in_progress: 'progress',
  'in-progress': 'progress',
  active: 'progress',
  completed: 'completed',
  captured: 'completed',
  paid: 'completed',
  approved: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  refunded: 'cancelled',
  failed: 'danger',
  rejected: 'danger',
  draft: 'neutral',
  published: 'completed',
};

const STYLES: Record<Variant, string> = {
  pending: 'bg-[hsl(var(--status-pending)/0.12)] text-[hsl(var(--status-pending))] ring-1 ring-inset ring-[hsl(var(--status-pending)/0.25)]',
  confirmed: 'bg-[hsl(var(--status-confirmed)/0.12)] text-[hsl(var(--status-confirmed))] ring-1 ring-inset ring-[hsl(var(--status-confirmed)/0.25)]',
  progress: 'bg-[hsl(var(--status-progress)/0.12)] text-[hsl(var(--status-progress))] ring-1 ring-inset ring-[hsl(var(--status-progress)/0.25)]',
  completed: 'bg-[hsl(var(--status-completed)/0.12)] text-[hsl(var(--status-completed))] ring-1 ring-inset ring-[hsl(var(--status-completed)/0.25)]',
  cancelled: 'bg-[hsl(var(--status-cancelled)/0.12)] text-[hsl(var(--status-cancelled))] ring-1 ring-inset ring-[hsl(var(--status-cancelled)/0.25)]',
  success: 'bg-[hsl(var(--action-success)/0.12)] text-[hsl(var(--action-success))] ring-1 ring-inset ring-[hsl(var(--action-success)/0.25)]',
  warning: 'bg-[hsl(var(--action-warning)/0.12)] text-[hsl(var(--action-warning))] ring-1 ring-inset ring-[hsl(var(--action-warning)/0.25)]',
  info: 'bg-[hsl(var(--action-info)/0.12)] text-[hsl(var(--action-info))] ring-1 ring-inset ring-[hsl(var(--action-info)/0.25)]',
  danger: 'bg-[hsl(var(--action-danger)/0.12)] text-[hsl(var(--action-danger))] ring-1 ring-inset ring-[hsl(var(--action-danger)/0.25)]',
  neutral: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
};

interface Props {
  status: string;
  variant?: Variant;
  className?: string;
  children?: React.ReactNode;
}

export const StatusBadge = ({ status, variant, className, children }: Props) => {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_');
  const resolved = variant || MAP[key] || 'neutral';
  const label = children ?? status.replace(/_/g, ' ');
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize',
      STYLES[resolved],
      className
    )}>
      {label}
    </span>
  );
};
