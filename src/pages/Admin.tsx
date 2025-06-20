
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
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

const Admin = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!user) {
      navigate('/');
    } else if (profile?.role !== 'admin') {
      navigate('/not-authorized');
    } else {
      setLoading(false);
    }
  }, [user, profile, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardStats />;
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
        return <PendingWorkersManager />;
      case 'sms':
        return <SMSLogsManager />;
      case 'blog':
        return <BlogManager />;
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
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Admin;
