
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Calendar, 
  Users, 
  UserCheck, 
  Settings, 
  CreditCard,
  Star,
  UserPlus,
  MessageSquare,
  FileText
} from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'workers', label: 'Workers', icon: UserCheck },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'services', label: 'Services', icon: Settings },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'applications', label: 'Applications', icon: UserPlus },
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'blog', label: 'Blog', icon: FileText },
  ];

  return (
    <aside className="w-64 bg-white shadow-sm border-r min-h-screen">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Admin Panel</h2>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeTab === item.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => onTabChange(item.id)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
