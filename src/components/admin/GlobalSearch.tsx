import React, { useState, useEffect } from 'react';
import { Search, Calendar, Users, Wrench, Star, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  section: string;
  icon: React.ComponentType<any>;
  action: () => void;
}

interface GlobalSearchProps {
  onNavigate: (section: string) => void;
}

export const GlobalSearch = ({ onNavigate }: GlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const searchResults: SearchResult[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'View business metrics and overview',
      section: 'Analytics',
      icon: Calendar,
      action: () => onNavigate('dashboard')
    },
    {
      id: 'bookings',
      title: 'Bookings',
      description: 'Manage customer bookings and appointments',
      section: 'Operations',
      icon: Calendar,
      action: () => onNavigate('bookings')
    },
    {
      id: 'customers',
      title: 'Customers',
      description: 'View and manage customer profiles',
      section: 'People',
      icon: Users,
      action: () => onNavigate('customers')
    },
    {
      id: 'workers',
      title: 'Workers',
      description: 'Manage worker assignments and schedules',
      section: 'People',
      icon: Wrench,
      action: () => onNavigate('workers')
    },
    {
      id: 'reviews',
      title: 'Reviews',
      description: 'Monitor customer feedback and ratings',
      section: 'Feedback',
      icon: Star,
      action: () => onNavigate('reviews')
    },
    {
      id: 'payments',
      title: 'Payments',
      description: 'Track payment transactions and status',
      section: 'Financial',
      icon: CreditCard,
      action: () => onNavigate('payments')
    },
    {
      id: 'invoices',
      title: 'Invoices',
      description: 'Generate and manage invoices',
      section: 'Financial',
      icon: FileText,
      action: () => onNavigate('invoices')
    }
  ];

  const groupedResults = searchResults.reduce((acc, result) => {
    if (!acc[result.section]) {
      acc[result.section] = [];
    }
    acc[result.section].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-8 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search admin...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search admin features..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Object.entries(groupedResults).map(([section, results]) => (
            <CommandGroup key={section} heading={section}>
              {results.map((result) => {
                const Icon = result.icon;
                return (
                  <CommandItem
                    key={result.id}
                    onSelect={() => {
                      result.action();
                      setOpen(false);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div>
                      <div className="font-medium">{result.title}</div>
                      <div className="text-xs text-muted-foreground">{result.description}</div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
};