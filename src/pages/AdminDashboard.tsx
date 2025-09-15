import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AdminServiceAreaManager } from '@/components/admin/AdminServiceAreaManager';
import { ZipCodeDataManager } from '@/components/admin/ZipCodeDataManager';
import { WorkerTipTracker } from '@/components/admin/WorkerTipTracker';
import { 
  Settings, 
  Database, 
  DollarSign, 
  Map,
  Users,
  BarChart3
} from 'lucide-react';

export const AdminDashboard = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage system data, worker assignments, and service operations
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Administration
        </Badge>
      </div>

      <Tabs defaultValue="spatial" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="spatial" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Spatial Data
          </TabsTrigger>
          <TabsTrigger value="tips" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Worker Tips
          </TabsTrigger>
          <TabsTrigger value="areas" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Service Areas
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="spatial" className="space-y-6">
          <ZipCodeDataManager />
        </TabsContent>

        <TabsContent value="tips" className="space-y-6">
          <WorkerTipTracker />
        </TabsContent>

        <TabsContent value="areas" className="space-y-6">
          <AdminServiceAreaManager />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                System Analytics
              </CardTitle>
              <CardDescription>
                View system performance metrics and usage statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};