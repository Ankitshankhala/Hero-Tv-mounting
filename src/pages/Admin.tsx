
import React from 'react';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { DashboardStats } from '@/components/admin/DashboardStats';
import { BookingsManager } from '@/components/admin/BookingsManager';
import { WorkersManager } from '@/components/admin/WorkersManager';
import { CustomersManager } from '@/components/admin/CustomersManager';
import { ServicesManager } from '@/components/admin/ServicesManager';
import { PaymentsManager } from '@/components/admin/PaymentsManager';
import { ReviewsManager } from '@/components/admin/ReviewsManager';
import { WorkerApplicationsManager } from '@/components/admin/WorkerApplicationsManager';
import { SMSLogsManager } from '@/components/admin/SMSLogsManager';
import { BlogManager } from '@/components/admin/BlogManager';
import { DataFetchingErrorChecker } from '@/components/DataFetchingErrorChecker';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <AdminLogin />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <DataFetchingErrorChecker />
            <DashboardStats />
          </div>
        );
      case 'bookings':
        return <BookingsManager />;
      case 'workers':
        return <WorkersManager />;
      case 'customers':
        return <CustomersManager />;
      case 'services':
        return <ServicesManager />;
      case 'payments':
        return <PaymentsManager />;
      case 'reviews':
        return <ReviewsManager />;
      case 'applications':
        return <WorkerApplicationsManager />;
      case 'sms':
        return <SMSLogsManager />;
      case 'blog':
        return <BlogManager />;
      case 'errors':
        return <DataFetchingErrorChecker />;
      default:
        return (
          <div className="space-y-6">
            <DataFetchingErrorChecker />
            <DashboardStats />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;
