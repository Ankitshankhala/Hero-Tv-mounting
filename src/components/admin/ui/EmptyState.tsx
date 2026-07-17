import React from 'react';
import { cn } from '@/lib/utils';
import { type LucideIcon, Inbox } from 'lucide-react';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon = Inbox, title, description, action, className }: Props) => (
  <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
