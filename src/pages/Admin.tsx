import React, { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { MainNav } from "@/components/main-nav"
import { Overview } from "@/components/admin/overview"
import { Bookings } from "@/components/admin/bookings"
import { Customers } from "@/components/admin/customers"
import { Workers } from "@/components/admin/workers"
import { Services } from "@/components/admin/services"
import { Payments } from "@/components/admin/payments"
import { Reviews } from "@/components/admin/reviews"
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import PendingWorkersManager from '@/components/admin/PendingWorkersManager';

const Admin = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <div className="border-b">
        <div className="flex h-20 items-center justify-between space-x-4 px-6">
          <MainNav className="mx-6" />
          <div className="flex-1 text-right font-medium">
            Admin Dashboard
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-8 bg-slate-800 border-slate-700">
            <TabsTrigger value="overview" className="text-white data-[state=active]:bg-slate-700">Overview</TabsTrigger>
            <TabsTrigger value="bookings" className="text-white data-[state=active]:bg-slate-700">Bookings</TabsTrigger>
            <TabsTrigger value="customers" className="text-white data-[state=active]:bg-slate-700">Customers</TabsTrigger>
            <TabsTrigger value="workers" className="text-white data-[state=active]:bg-slate-700">Workers</TabsTrigger>
            <TabsTrigger value="pending" className="text-white data-[state=active]:bg-slate-700">Pending</TabsTrigger>
            <TabsTrigger value="services" className="text-white data-[state=active]:bg-slate-700">Services</TabsTrigger>
            <TabsTrigger value="payments" className="text-white data-[state=active]:bg-slate-700">Payments</TabsTrigger>
            <TabsTrigger value="reviews" className="text-white data-[state=active]:bg-slate-700">Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <Overview />
          </TabsContent>
          <TabsContent value="bookings" className="mt-6">
            <Bookings />
          </TabsContent>
          <TabsContent value="customers" className="mt-6">
            <Customers />
          </TabsContent>
          <TabsContent value="workers" className="mt-6">
            <Workers />
          </TabsContent>
          <TabsContent value="pending" className="mt-6">
            <PendingWorkersManager />
          </TabsContent>
          <TabsContent value="services" className="mt-6">
            <Services />
          </TabsContent>
          <TabsContent value="payments" className="mt-6">
            <Payments />
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <Reviews />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Admin;
