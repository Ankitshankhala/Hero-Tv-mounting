import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart3, Calendar, Users, Wrench, Settings, Star, CreditCard,
  FileText, MessageSquare, MapPin, Mail, DollarSign, Wallet, Tag,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const groups = [
  { label: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  ]},
  { label: 'Operations', items: [
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'workers', label: 'Workers', icon: Wrench },
    { id: 'coverage', label: 'Service Areas', icon: MapPin },
  ]},
  { label: 'Money', items: [
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'payroll', label: 'Payroll', icon: Wallet },
    { id: 'tips', label: 'Tips', icon: DollarSign },
    { id: 'coupons', label: 'Coupons', icon: Tag },
  ]},
  { label: 'Content', items: [
    { id: 'blog', label: 'Blog', icon: FileText },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'services', label: 'Services', icon: Wrench },
  ]},
  { label: 'System', items: [
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'email', label: 'Email Logs', icon: Mail },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]},
];

export const AdminSideNav = ({ activeTab, onTabChange }: Props) => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 px-4 flex flex-row items-center gap-2 border-b border-sidebar-border">
        <img
          src="/assets/images/logo.png"
          alt="Hero TV Mounting"
          className="h-7 w-7 rounded-md object-contain shrink-0"
        />
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            Hero Admin
          </span>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium px-2">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          'h-9 rounded-md text-sm transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                        )}
                      >
                        <NavLink
                          to={`/admin?tab=${item.id}`}
                          onClick={() => onTabChange(item.id)}
                          className="flex items-center gap-2.5"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
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
};
