import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const Toolbar = ({ search, onSearchChange, searchPlaceholder = 'Search...', filters, actions, className }: Props) => (
  <div className={cn('flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4', className)}>
    <div className="flex flex-1 items-center gap-2 min-w-0">
      {onSearchChange && (
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 h-9"
          />
        </div>
      )}
      {filters}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
