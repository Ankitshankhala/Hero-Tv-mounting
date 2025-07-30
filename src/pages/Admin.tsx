
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { DashboardStats } from '@/components/admin/DashboardStats';
import { BookingsManager } from '@/components/admin/BookingsManager';
import { WorkersManager } from '@/components/admin/WorkersManager';
import { CustomersManager } from '@/components/admin/CustomersManager';
import { ServicesManager } from '@/components/admin/ServicesManager';
import { PaymentsManager } from '@/components/admin/PaymentsManager';
import { ReviewsManager } from '@/components/admin/ReviewsManager';
import PendingWorkersManager from '@/components/admin/PendingWorkersManager';
import { SMSLogsManager } from '@/components/admin/SMSLogsManager';
import { BlogManager } from '@/components/admin/BlogManager';
import { AdminCalendarView } from '@/components/admin/AdminCalendarView';
import { CoverageRequestsManager } from '@/components/admin/CoverageRequestsManager';
import { InvoicesManager } from '@/components/admin/InvoicesManager';
import { PerformanceDashboard } from '@/components/admin/PerformanceDashboard';
import { DeploymentPanel } from '@/components/admin/DeploymentPanel';
import { EmailTestButton } from '@/components/admin/EmailTestButton';
import { InvoiceTestButton } from '@/components/admin/InvoiceTestButton';
import { BookingStatusTestButton } from '@/components/admin/BookingStatusTestButton';

const Admin = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  console.log('Admin page - Auth state:', { user: user?.email, profile: profile?.role, loading });

  // Show loading while auth is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    console.log('No user found, showing login form');
    return <AdminLogin />;
  }

  // Show access denied if not admin
  if (profile && profile.role !== 'admin') {
    console.log('User is not admin:', profile.role);
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
              <p className="text-gray-600 mt-2">You are not authorized to view this page.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading if we have a user but no profile yet
  if (user && !profile) {
    console.log('User exists but no profile loaded yet');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  console.log('Rendering admin dashboard for:', user.email);

  const renderContent = () => {
    switch (activeTab) {
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
      case 'reviews':
        return <ReviewsManager />;
      case 'payments':
        return <PaymentsManager />;
      case 'invoices':
        return <InvoicesManager />;
      case 'sms':
        return <SMSLogsManager />;
      case 'blog':
        return <BlogManager />;
      case 'coverage':
        return <CoverageRequestsManager />;
      case 'performance':
        return <PerformanceDashboard />;
      case 'deployment':
        return <DeploymentPanel />;
      default:
        return <DashboardStats />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex w-full">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        <main className="flex-1 p-6">
          <div className="mb-4 flex gap-2">
            <EmailTestButton />
            <InvoiceTestButton />
            <BookingStatusTestButton />
          </div>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Admin;
