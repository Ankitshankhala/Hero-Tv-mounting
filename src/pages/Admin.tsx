
import React, { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your TV mounting service business</p>
      </div>
      
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800 border-slate-700">
          <TabsTrigger value="pending" className="text-white data-[state=active]:bg-slate-700">Pending Workers</TabsTrigger>
          <TabsTrigger value="overview" className="text-white data-[state=active]:bg-slate-700">Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-6">
          <PendingWorkersManager />
        </TabsContent>
        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600">Admin overview coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
