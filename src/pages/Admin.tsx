
import React, { useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { DashboardStats } from '@/components/admin/DashboardStats';
import { BookingsManager } from '@/components/admin/BookingsManager';
import { CustomersManager } from '@/components/admin/CustomersManager';
import { WorkersManager } from '@/components/admin/WorkersManager';
import { ServicesManager } from '@/components/admin/ServicesManager';
import { PaymentsManager } from '@/components/admin/PaymentsManager';
import { SMSLogsManager } from '@/components/admin/SMSLogsManager';
import { ReviewsManager } from '@/components/admin/ReviewsManager';
import { BlogManager } from '@/components/admin/BlogManager';
import { AdminLogin } from '@/components/admin/AdminLogin';

const Admin = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardStats />;
      case 'bookings':
        return <BookingsManager />;
      case 'customers':
        return <CustomersManager />;
      case 'workers':
        return <WorkersManager />;
      case 'services':
        return <ServicesManager />;
      case 'payments':
        return <PaymentsManager />;
      case 'sms':
        return <SMSLogsManager />;
      case 'reviews':
        return <ReviewsManager />;
      case 'blog':
        return <BlogManager />;
      default:
        return <DashboardStats />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
      />
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        <main className="flex-1 p-6">
          {renderActiveSection()}
        </main>
      </div>
    </div>
  );
};

export default Admin;
