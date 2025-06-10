
import React from 'react';
import { Card } from '@/components/ui/card';
import { 
  BarChart3, 
  Calendar, 
  Users, 
  Wrench, 
  Settings, 
  CreditCard, 
  MessageSquare, 
  Star, 
  FileText 
} from 'lucide-react';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const AdminSidebar = ({ activeSection, onSectionChange }: AdminSidebarProps) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'workers', label: 'Workers', icon: Wrench },
    { id: 'services', label: 'Services', icon: Settings },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'blog', label: 'Blog Manager', icon: FileText },
  ];

  return (
    <div className="w-64 bg-white shadow-lg h-screen">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-gray-800">TV Mount Pro</h1>
        <p className="text-sm text-gray-600">Admin Dashboard</p>
      </div>
      <nav className="p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${
                activeSection === item.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
