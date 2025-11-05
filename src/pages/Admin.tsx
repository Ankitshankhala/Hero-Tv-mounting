
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { DashboardStats } from '@/components/admin/DashboardStats';
import { SEO } from '@/components/SEO';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TourProvider } from '@/contexts/TourContext';
import { TourManager } from '@/components/tour/TourManager';

// Lazy load heavy admin components for better performance
const LazyBookingsManager = lazy(() => import('@/components/admin/BookingsManager').then(m => ({ default: m.BookingsManager })));
const LazyWorkersManager = lazy(() => import('@/components/admin/WorkersManager').then(m => ({ default: m.WorkersManager })));
const LazyCustomersManager = lazy(() => import('@/components/admin/CustomersManager').then(m => ({ default: m.CustomersManager })));
const LazyServicesManager = lazy(() => import('@/components/admin/ServicesManager').then(m => ({ default: m.ServicesManager })));
const LazyPaymentsManager = lazy(() => import('@/components/admin/PaymentsManager').then(m => ({ default: m.PaymentsManager })));
const LazyReviewsManager = lazy(() => import('@/components/admin/ReviewsManager').then(m => ({ default: m.ReviewsManager })));
const LazyPendingWorkersManager = lazy(() => import('@/components/admin/PendingWorkersManager'));
const LazySMSLogsManager = lazy(() => import('@/components/admin/SMSLogsManager').then(m => ({ default: m.SMSLogsManager })));
const LazyBlogManager = lazy(() => import('@/components/admin/BlogManager').then(m => ({ default: m.BlogManager })));
const LazyAdminCalendarView = lazy(() => import('@/components/admin/AdminCalendarView').then(m => ({ default: m.AdminCalendarView })));
const LazyCoverageRequestsManager = lazy(() => import('@/components/admin/CoverageRequestsManager').then(m => ({ default: m.CoverageRequestsManager })));
const LazyAdminServiceAreasUnified = lazy(() => import('@/components/admin/AdminServiceAreasUnified').then(m => ({ default: m.AdminServiceAreasUnified })));
const LazyInvoicesManager = lazy(() => import('@/components/admin/InvoicesManager').then(m => ({ default: m.InvoicesManager })));
const LazyInvoiceMonitoringPanel = lazy(() => import('@/components/admin/InvoiceMonitoringPanel').then(m => ({ default: m.InvoiceMonitoringPanel })));
const LazyEmailLogsManager = lazy(() => import('@/components/admin/EmailLogsManager').then(m => ({ default: m.EmailLogsManager })));
const LazyNotificationsSettings = lazy(() => import('@/components/admin/NotificationsSettings').then(m => ({ default: m.NotificationsSettings })));
const LazyTipAnalyticsDashboard = lazy(() => import('@/components/admin/TipAnalyticsDashboard').then(m => ({ default: m.TipAnalyticsDashboard })));
const LazyWorkerWeeklyPayments = lazy(() => import('@/components/admin/WorkerWeeklyPayments').then(m => ({ default: m.WorkerWeeklyPayments })));


// Loading component for lazy-loaded components
const ComponentLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex items-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span>Loading...</span>
    </div>
  </div>
);

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
    const wrapWithSuspense = (Component: React.ComponentType) => (
      <Suspense fallback={<ComponentLoader />}>
        <Component />
      </Suspense>
    );

    switch (activeTab) {
      case 'dashboard':
        return <DashboardStats />;
      case 'bookings':
        return wrapWithSuspense(LazyBookingsManager);
      case 'customers':
        return wrapWithSuspense(LazyCustomersManager);
      case 'workers':
        return wrapWithSuspense(LazyWorkersManager);
      case 'services':
        return wrapWithSuspense(LazyServicesManager);
      case 'reviews':
        return wrapWithSuspense(LazyReviewsManager);
      case 'payments':
        return wrapWithSuspense(LazyPaymentsManager);
      case 'invoices':
        return (
          <Suspense fallback={<ComponentLoader />}>
            <div className="space-y-6">
              <LazyInvoiceMonitoringPanel />
              <LazyInvoicesManager />
            </div>
          </Suspense>
        );
      case 'sms':
        return wrapWithSuspense(LazySMSLogsManager);
      case 'email':
        return wrapWithSuspense(LazyEmailLogsManager);
      case 'blog':
        return wrapWithSuspense(LazyBlogManager);
      case 'coverage':
      case 'service-areas':
        return wrapWithSuspense(LazyAdminServiceAreasUnified);
      case 'tips':
        return wrapWithSuspense(LazyTipAnalyticsDashboard);
      case 'payroll':
        return wrapWithSuspense(LazyWorkerWeeklyPayments);
      case 'settings':
        return wrapWithSuspense(LazyNotificationsSettings);
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
