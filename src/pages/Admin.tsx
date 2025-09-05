
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
import { AdminCoverageManager } from '@/components/admin/AdminCoverageManager';
import { AdminServiceAreaManager } from '@/components/admin/AdminServiceAreaManager';
import { InvoicesManager } from '@/components/admin/InvoicesManager';
import { InvoiceMonitoringPanel } from '@/components/admin/InvoiceMonitoringPanel';
import { EmailLogsManager } from '@/components/admin/EmailLogsManager';
import { SEO } from '@/components/SEO';
import { NotificationsSettings } from '@/components/admin/NotificationsSettings';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarTrigger } from '@/components/ui/sidebar';
import { TourProvider } from '@/contexts/TourContext';
import { TourManager } from '@/components/tour/TourManager';

const Admin = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Get sidebar state from cookie for persistence  
  const getSidebarState = () => {
    if (typeof window !== 'undefined') {
      const saved = document.cookie
        .split('; ')
        .find(row => row.startsWith('sidebar:state='))
        ?.split('=')[1];
      return saved === 'true';
    }
    return false;
  };

  // Sync activeTab with URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [activeTab]);

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
        return (
          <div className="space-y-6">
            <InvoiceMonitoringPanel />
            <InvoicesManager />
          </div>
        );
      case 'sms':
        return <SMSLogsManager />;
      case 'email':
        return <EmailLogsManager />;
      case 'blog':
        return <BlogManager />;
      case 'coverage':
        return <AdminCoverageManager />;
      case 'service-areas':
        return <AdminServiceAreaManager />;
      case 'settings':
        return <NotificationsSettings />;
      case 'invoice-monitoring':
      case 'email-notifications':
        // Redirect to dashboard for hidden tabs
        setActiveTab('dashboard');
        return <DashboardStats />;
      default:
        return <DashboardStats />;
    }
  };

  return (
    <TourProvider>
      <SEO 
        title="Admin Dashboard | Hero TV Mounting"
        description="Admin controls for bookings, payments, invoices, and system health."
        noindex
      />
      <SidebarProvider
        defaultOpen={getSidebarState()}
        className="w-full"
        style={{
          "--sidebar-width": "280px",
          "--sidebar-width-mobile": "280px",
        } as React.CSSProperties}
      >
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex w-full overflow-hidden">
          <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader onNavigate={setActiveTab} />
            <main className="flex-1 p-4 lg:p-6 overflow-auto">
              <div className="max-w-full">
                {renderContent()}
              </div>
            </main>
          </div>
        </div>
        
        <TourManager />
      </SidebarProvider>
    </TourProvider>
  );
};

export default Admin;
