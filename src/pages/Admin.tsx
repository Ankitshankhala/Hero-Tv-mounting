
import React, { useState, useEffect } from 'react';
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
import { useAuth } from '@/hooks/useAuth';

const Admin = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { user, profile, isAdmin, loading } = useAuth();

  useEffect(() => {
    console.log('Admin page auth state:', { 
      user: user?.email, 
      profile: profile?.role, 
      isAdmin, 
      loading 
    });
  }, [user, profile, isAdmin, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if no user or not admin
  if (!user || !profile || !isAdmin) {
    console.log('Showing admin login - user:', !!user, 'profile:', !!profile, 'isAdmin:', isAdmin);
    return <AdminLogin onLogin={() => {}} />;
  }

  console.log('Showing admin dashboard for:', user.email);

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
