
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Calendar,
  Users, 
  Briefcase, 
  Settings, 
  CreditCard,
  Star,
  FileText,
  MessageSquare,
  Phone,
  UserPlus
} from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'bookings', label: 'Bookings', icon: Briefcase },
    { id: 'coverage', label: 'Coverage Requests', icon: MessageSquare },
    { id: 'workers', label: 'Workers', icon: Users },
    { id: 'applications', label: 'Applications', icon: UserPlus },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'services', label: 'Services', icon: Settings },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'sms', label: 'SMS Logs', icon: Phone },
    { id: 'blog', label: 'Blog', icon: FileText },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800">Admin Panel</h2>
      </div>
      
      <nav className="mt-8">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className="w-full justify-start px-6 py-3 h-auto"
              onClick={() => onTabChange(item.id)}
            >
              <Icon className="h-5 w-5 mr-3" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </div>
  );
};
