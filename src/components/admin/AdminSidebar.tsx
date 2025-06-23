
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
  Activity,
  Rocket,
  Shield
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
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'blog', label: 'Blog', icon: FileText },
    { id: 'coverage', label: 'Coverage Requests', icon: MapPin },
    { id: 'performance', label: 'Performance', icon: Activity },
    { id: 'deployment', label: 'Deployment', icon: Rocket },
  ];

  return (
    <div className="w-64 border-r flex-shrink-0">
      <div className="p-4">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>
      <div className="py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.id}
            to={`/admin?tab=${item.id}`}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-2 px-4 py-2 hover:bg-gray-100",
                isActive ? "font-medium bg-gray-100" : "text-gray-600"
              )
            }
            onClick={() => onTabChange(item.id)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};
