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

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'workers', label: 'Workers', icon: Wrench },
    { id: 'services', label: 'Services', icon: Settings },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'invoice-monitoring', label: 'Invoice Monitor', icon: FileText },
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'email', label: 'Email Logs', icon: Mail },
    { id: 'blog', label: 'Blog', icon: FileText },
    { id: 'coverage', label: 'Coverage Requests', icon: MapPin },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-background/95 border-r border-border flex-shrink-0 backdrop-blur-sm">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <img 
            src="/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png" 
            alt="Hero TV Mounting Logo" 
            className="h-8 w-8 object-contain"
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Admin Panel</h1>
        </div>
      </div>
      <nav className="px-3 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.id}
            to={`/admin?tab=${item.id}`}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isActive 
                  ? "bg-accent text-accent-foreground shadow-sm" 
                  : "text-muted-foreground"
              )
            }
            onClick={() => onTabChange(item.id)}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
