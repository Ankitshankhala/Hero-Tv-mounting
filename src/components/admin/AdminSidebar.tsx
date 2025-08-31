import React from 'react';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  Calendar, 
  Users, 
  Wrench, 
  Settings, 
  Star, 
  CreditCard, 
  FileText,
  MessageSquare, 
  MapPin,
  Mail
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const menuGroups = [
    {
      label: 'Analytics',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3, tourAttr: 'admin-dashboard' },
      ]
    },
    {
      label: 'Operations',
      items: [
        { id: 'bookings', label: 'Bookings', icon: Calendar, tourAttr: 'admin-bookings', badge: 'new' },
        { id: 'services', label: 'Services', icon: Wrench },
        { id: 'coverage', label: 'Coverage Areas', icon: MapPin },
      ]
    },
    {
      label: 'People',
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'workers', label: 'Workers', icon: Wrench, tourAttr: 'admin-workers' },
        { id: 'reviews', label: 'Reviews', icon: Star },
      ]
    },
    {
      label: 'Financial',
      items: [
        { id: 'payments', label: 'Payments', icon: CreditCard, tourAttr: 'admin-payments' },
        { id: 'invoices', label: 'Invoices', icon: FileText },
      ]
    },
    {
      label: 'Communications',
      items: [
        { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
        { id: 'email', label: 'Email Logs', icon: Mail },
      ]
    },
    {
      label: 'Content & Settings',
      items: [
        { id: 'blog', label: 'Blog', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings, tourAttr: 'admin-settings' },
      ]
    }
  ];

  return (
    <Sidebar className="border-slate-700 bg-background/95 backdrop-blur-sm">
      <SidebarHeader className="p-6">
        <div className="flex items-center space-x-3">
          <img 
            src="/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png" 
            alt="Hero TV Mounting Logo" 
            className="h-8 w-8 object-contain"
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Admin Panel
          </h1>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-muted-foreground/70 font-medium text-xs uppercase tracking-wider">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={activeTab === item.id}
                            className={cn(
                              "w-full text-left transition-all duration-200 group relative",
                              "hover:bg-accent hover:text-accent-foreground",
                              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                              activeTab === item.id 
                                ? "bg-accent text-accent-foreground shadow-sm font-medium" 
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            {...(item.tourAttr && { 'data-tour': item.tourAttr })}
                          >
                            <NavLink
                              to={`/admin?tab=${item.id}`}
                              onClick={() => onTabChange(item.id)}
                              className="flex items-center gap-3 w-full"
                            >
                              <item.icon className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="truncate">{item.label}</span>
                              {item.badge && (
                                <span className="ml-auto bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                                  {item.badge}
                                </span>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="md:hidden">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};