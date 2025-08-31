import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Briefcase, 
  Calendar, 
  Clock, 
  MapPin, 
  Archive, 
  DollarSign, 
  Bell, 
  Settings,
  Menu
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WorkerSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  stats?: {
    todaysJobs: number;
    upcomingJobs: number;
    notifications: number;
    archivedJobs: number;
  };
}

export function WorkerSidebar({ activeSection, onSectionChange, stats }: WorkerSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const menuSections = [
    {
      label: 'Main',
      items: [
        { 
          key: 'dashboard', 
          title: 'Dashboard', 
          icon: Home, 
          badge: stats?.todaysJobs ? `${stats.todaysJobs}` : undefined 
        },
        { 
          key: 'jobs', 
          title: 'My Jobs', 
          icon: Briefcase, 
          badge: stats?.upcomingJobs ? `${stats.upcomingJobs}` : undefined 
        },
        { 
          key: 'calendar', 
          title: 'Calendar', 
          icon: Calendar 
        },
      ]
    },
    {
      label: 'Management',
      items: [
        { 
          key: 'schedule', 
          title: 'Set Schedule', 
          icon: Clock 
        },
        { 
          key: 'service-area', 
          title: 'Service Area', 
          icon: MapPin 
        },
        { 
          key: 'archived', 
          title: 'Archived Jobs', 
          icon: Archive, 
          badge: stats?.archivedJobs ? `${stats.archivedJobs}` : undefined 
        },
      ]
    },
    {
      label: 'Account',
      items: [
        { 
          key: 'earnings', 
          title: 'Earnings', 
          icon: DollarSign 
        },
        { 
          key: 'notifications', 
          title: 'Notifications', 
          icon: Bell, 
          badge: stats?.notifications ? `${stats.notifications}` : undefined 
        },
        { 
          key: 'profile', 
          title: 'Profile & Settings', 
          icon: Settings 
        },
      ]
    }
  ];

  const isActive = (key: string) => activeSection === key;

  return (
    <Sidebar className={cn("transition-all duration-300", collapsed ? "w-14" : "w-64")} collapsible="icon">
      {/* Mobile trigger */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border">
        <SidebarTrigger asChild>
          <Button variant="ghost" size="sm">
            <Menu className="h-4 w-4" />
          </Button>
        </SidebarTrigger>
      </div>

      <SidebarContent className="bg-card border-r border-border">
        {menuSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider font-medium px-3 py-2">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const IconComponent = item.icon;
                  const active = isActive(item.key);
                  
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        onClick={() => onSectionChange(item.key)}
                        className={cn(
                          "w-full justify-start gap-3 px-3 py-2.5 rounded-lg transition-colors",
                          active 
                            ? "bg-primary text-primary-foreground font-medium" 
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <IconComponent className={cn("h-4 w-4 flex-shrink-0", active && "text-primary-foreground")} />
                          
                          {!collapsed && (
                            <span className="flex-1 text-left">{item.title}</span>
                          )}
                          
                          {!collapsed && item.badge && (
                            <Badge 
                              variant={active ? "secondary" : "outline"} 
                              className="ml-auto text-xs h-5 px-1.5"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}