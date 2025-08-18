import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';

export const ArrowSidebarToggle = () => {
  const { open, toggleSidebar } = useSidebar();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleSidebar}
            className="bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-600 hover:text-white transition-all duration-200 min-w-fit"
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            <span className="text-lg font-bold mr-2">
              {open ? '←' : '→'}
            </span>
            <span className="hidden md:inline">Admin Panel</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{open ? "Collapse sidebar" : "Expand sidebar"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};