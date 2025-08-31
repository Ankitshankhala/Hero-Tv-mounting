import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  Calendar, 
  DollarSign, 
  Clock, 
  Settings, 
  Bell,
  User,
  MapPin,
  Archive,
  TrendingUp
} from 'lucide-react';
import { NotificationBellWorker } from './NotificationBellWorker';

interface WorkerSidebarProps {
  jobStats: {
    activeJobs: number;
    upcomingJobs: number;
    pendingPayments: number;
  };
}

export function WorkerSidebar({ jobStats }: WorkerSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path);
  
  const getNavClasses = (path: string) => {
    return isActive(path) 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50 text-sidebar-foreground";
  };

  const mainNavItems = [
    {
      title: "Active Jobs",
      url: "/worker-dashboard",
      icon: Briefcase,
      badge: jobStats.activeJobs > 0 ? jobStats.activeJobs : null,
      badgeVariant: "default" as const
    },
    {
      title: "Calendar",
      url: "/worker-dashboard/calendar",
      icon: Calendar,
      badge: jobStats.upcomingJobs > 0 ? jobStats.upcomingJobs : null,
      badgeVariant: "secondary" as const
    },
    {
      title: "Earnings",
      url: "/worker-dashboard/earnings", 
      icon: DollarSign,
      badge: null,
      badgeVariant: "default" as const
    },
    {
      title: "Notifications",
      url: "/worker-dashboard/notifications",
      icon: Bell,
      badge: null, // Will be handled by NotificationBellWorker
      badgeVariant: "destructive" as const
    }
  ];

  const settingsNavItems = [
    {
      title: "Schedule",
      url: "/worker-dashboard/schedule",
      icon: Clock,
      badge: null,
      badgeVariant: "default" as const
    },
    {
      title: "Service Area",
      url: "/worker-dashboard/service-area", 
      icon: MapPin,
      badge: null,
      badgeVariant: "default" as const
    },
    {
      title: "Profile",
      url: "/worker-dashboard/profile",
      icon: User,
      badge: null,
      badgeVariant: "default" as const
    }
  ];

  const archiveNavItems = [
    {
      title: "Job History",
      url: "/worker-dashboard/archived",
      icon: Archive,
      badge: null,
      badgeVariant: "default" as const
    }
  ];

  const renderNavItem = (item: typeof mainNavItems[0]) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink to={item.url} className={getNavClasses(item.url)}>
          <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1">{item.title}</span>
              {item.title === "Notifications" ? (
                <NotificationBellWorker hideIcon />
              ) : item.badge && (
                <Badge variant={item.badgeVariant} className="ml-auto text-xs">
                  {item.badge}
                </Badge>
              )}
            </>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-64"}
      collapsible="icon"
    >
      <SidebarTrigger className="m-2 self-end" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground font-semibold">
            {!collapsed && "Dashboard"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground font-semibold">
            {!collapsed && "Settings"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground font-semibold">
            {!collapsed && "History"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {archiveNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}