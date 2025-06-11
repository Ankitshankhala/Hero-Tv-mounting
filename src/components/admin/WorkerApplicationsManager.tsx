
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, Phone, Mail, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const WorkerApplicationsManager = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('worker_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching worker applications:', error);
        toast({
          title: "Error",
          description: "Failed to fetch worker applications",
          variant: "destructive",
        });
        setApplications([]);
      } else {
        setApplications(data || []);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch worker applications",
        variant: "destructive",
      });
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('worker_applications')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setApplications(applications.map(app => 
        app.id === id ? { ...app, status } : app
      ));

      toast({
        title: "Success",
        description: `Application ${status}`,
      });
    } catch (error) {
      console.error('Error updating application:', error);
      toast({
        title: "Error",
        description: "Failed to update application",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      approved: { label: 'Approved', variant: 'default' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatAvailability = (availability: any) => {
    if (!availability) return 'Not specified';
    const days = Object.entries(availability)
      .filter(([_, isAvailable]) => isAvailable)
      .map(([day, _]) => day.charAt(0).toUpperCase() + day.slice(1, 3));
    return days.length > 0 ? days.join(', ') : 'Not specified';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Worker Applications</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No applications found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((application: any) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{application.name}</div>
                          <div className="text-sm text-gray-600">
                            {application.experience?.substring(0, 50)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm">
                            <Mail className="h-3 w-3" />
                            <span>{application.email}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="h-3 w-3" />
                            <span>{application.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2 text-sm">
                          <MapPin className="h-3 w-3" />
                          <span>{application.city}, {application.region}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatAvailability(application.availability)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(application.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {new Date(application.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {application.status === 'pending' && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateApplicationStatus(application.id, 'approved')}
                              className="text-green-600 hover:bg-green-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateApplicationStatus(application.id, 'rejected')}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
