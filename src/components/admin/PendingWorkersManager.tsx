
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, User, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingWorker {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  zip_code: string;
  experience: string;
  skills: string;
  created_at: string;
  is_active: boolean;
}

const PendingWorkersManager = () => {
  const [pendingWorkers, setPendingWorkers] = useState<PendingWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingWorkers();
  }, []);

  const fetchPendingWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'worker')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingWorkers(data || []);
    } catch (error) {
      console.error('Error fetching pending workers:', error);
      toast({
        title: "Error",
        description: "Failed to load pending workers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWorker = async (workerId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', workerId);

      if (error) throw error;

      toast({
        title: "Worker Approved",
        description: "The worker has been approved and can now log in.",
      });

      // Remove from pending list
      setPendingWorkers(prev => prev.filter(worker => worker.id !== workerId));
    } catch (error) {
      console.error('Error approving worker:', error);
      toast({
        title: "Error",
        description: "Failed to approve worker",
        variant: "destructive",
      });
    }
  };

  const handleRejectWorker = async (workerId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', workerId);

      if (error) throw error;

      toast({
        title: "Worker Rejected",
        description: "The worker application has been rejected and removed.",
      });

      // Remove from pending list
      setPendingWorkers(prev => prev.filter(worker => worker.id !== workerId));
    } catch (error) {
      console.error('Error rejecting worker:', error);
      toast({
        title: "Error",
        description: "Failed to reject worker",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Pending Worker Registrations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Pending Worker Registrations</span>
          <Badge variant="secondary">{pendingWorkers.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pendingWorkers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No pending worker registrations</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingWorkers.map((worker) => (
              <div key={worker.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{worker.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{worker.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{worker.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{worker.city}, {worker.region} - {worker.zip_code}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    Pending
                  </Badge>
                </div>

                {worker.experience && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Experience:</h4>
                    <p className="text-sm text-gray-600">{worker.experience}</p>
                  </div>
                )}

                {worker.skills && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Skills:</h4>
                    <p className="text-sm text-gray-600">{worker.skills}</p>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <Button
                    onClick={() => handleApproveWorker(worker.id)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleRejectWorker(worker.id)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingWorkersManager;
