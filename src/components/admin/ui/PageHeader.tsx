import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({ title, subtitle, actions, className }: Props) => (
  <div className={cn('flex items-start justify-between gap-4 pb-5 mb-5 border-b border-border', className)}>
    <div className="min-w-0">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
