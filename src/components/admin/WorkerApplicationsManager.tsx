import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, Clock, Phone, Mail, MapPin, User, Briefcase, Copy, Eye, EyeOff, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { WorkerPasswordManager } from './WorkerPasswordManager';

// Use the Supabase generated type instead of defining our own
type WorkerApplication = Tables<'worker_applications'>;

interface ApprovalResult {
  email: string;
  temporaryPassword: string;
}

export const WorkerApplicationsManager = () => {
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordManagerOpen, setPasswordManagerOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<{ id: string; email: string; name: string } | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Password copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      });
    }
  };

  const openPasswordManager = (application: WorkerApplication) => {
    // We need to get the user ID from the users table based on the email
    const findWorkerAndOpenModal = async () => {
      try {
        const { data: worker, error } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('email', application.email)
          .eq('role', 'worker')
          .single();

        if (error || !worker) {
          toast({
            title: "Error",
            description: "Worker not found in the system",
            variant: "destructive",
          });
          return;
        }

        setSelectedWorker({
          id: worker.id,
          email: worker.email,
          name: worker.name || application.name,
        });
        setPasswordManagerOpen(true);
      } catch (error) {
        console.error('Error finding worker:', error);
        toast({
          title: "Error",
          description: "Failed to find worker",
          variant: "destructive",
        });
      }
    };

    findWorkerAndOpenModal();
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('worker_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: "Failed to load worker applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      setProcessingId(id);
      
      if (status === 'approved') {
        // Call the edge function to approve the worker application
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error('No active session');
        }

        // Try the simple approval function first
        console.log('Calling simple approval function for application:', id);
        const { data, error } = await supabase.functions.invoke('approve-worker-simple', {
          body: { applicationId: id }
        });

        if (error) {
          console.error('Edge function error:', error);
          throw error;
        }

        console.log('Approval response:', data);

        // Show password modal if a temporary password was generated
        if (data.email && data.temporaryPassword) {
          setApprovalResult({
            email: data.email,
            temporaryPassword: data.temporaryPassword
          });
          setShowPasswordModal(true);
        }

        toast({
          title: "Success",
          description: data.isExistingUser 
            ? "Application approved! Worker account was already active."
            : "Application approved! Worker account created successfully.",
        });
      } else {
        // Handle rejection
        const { error } = await supabase
          .from('worker_applications')
          .update({ status: 'rejected' })
          .eq('id', id);

        if (error) {
          console.error('Error rejecting application:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Application rejected successfully",
        });
      }

      fetchApplications(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating application:', error);
      
      let errorMessage = "Failed to update application status";
      
      if (error?.message?.includes('duplicate key')) {
        errorMessage = "This email is already registered in the system";
      } else if (error?.message?.includes('Insufficient permissions')) {
        errorMessage = "You don't have permission to perform this action";
      } else if (error?.message?.includes('Invalid authorization')) {
        errorMessage = "Authentication failed. Please refresh and try again";
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const deleteApplication = async (id: string) => {
    try {
      setDeletingId(id);
      
      const { error } = await supabase
        .from('worker_applications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Worker application deleted successfully",
      });

      fetchApplications(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting application:', error);
      
      toast({
        title: "Error",
        description: error?.message || "Failed to delete application",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const getStatusBadge = (status: string | null) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
      approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
      rejected: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
    };
    
    const config = statusConfig[(status || 'pending') as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </Badge>
    );
  };

  const formatAvailability = (availability: any) => {
    if (!availability || typeof availability !== 'object') {
      return 'Not specified';
    }
    
    const days = Object.entries(availability as Record<string, boolean>)
      .filter(([_, available]) => available)
      .map(([day, _]) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(', ');
    return days || 'Not specified';
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
            <Briefcase className="h-5 w-5" />
            <span>Worker Applications ({applications.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No worker applications found</p>
              <p className="text-sm text-gray-400 mt-2">
                Applications will appear here when workers apply through the application form.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Resources</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span>{application.name}</span>
                          </div>
                          <div className="text-sm text-gray-600">{application.skills}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span>{application.email}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span>{application.phone}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{application.city}</div>
                            <div className="text-sm text-gray-600">{application.region}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm max-w-xs truncate" title={application.experience}>
                          {application.experience}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatAvailability(application.availability)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${application.has_vehicle ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            <span className="text-xs">Vehicle</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${application.has_tools ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            <span className="text-xs">Tools</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(application.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {application.created_at ? new Date(application.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {application.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateApplicationStatus(application.id, 'approved')}
                                disabled={processingId === application.id}
                                className="text-green-600 hover:text-green-700"
                              >
                                {processingId === application.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateApplicationStatus(application.id, 'rejected')}
                                disabled={processingId === application.id}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          
                           {application.status === 'approved' && (
                             <div className="flex items-center space-x-2">
                               <div className="text-xs text-green-600 font-medium">
                                 Profile Created
                               </div>
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => openPasswordManager(application)}
                                 className="text-blue-600 hover:text-blue-700"
                                 title="Manage Password"
                               >
                                 <Settings className="h-4 w-4" />
                               </Button>
                             </div>
                           )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deletingId === application.id}
                              >
                                {deletingId === application.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Application</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the application from <strong>{application.name}</strong> ({application.email})?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteApplication(application.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Temporary Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Worker Account Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 mb-3">
                Worker account has been successfully created for:
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Email:</label>
                  <p className="font-medium">{approvalResult?.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Temporary Password:</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 p-2 bg-gray-100 rounded border font-mono text-sm">
                      {showPassword ? approvalResult?.temporaryPassword : '••••••••••••'}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(approvalResult?.temporaryPassword || '')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Share these credentials with the worker securely. 
                They should change their password on first login.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => {
                setShowPasswordModal(false);
                setApprovalResult(null);
                setShowPassword(false);
              }}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Worker Password Manager */}
      {selectedWorker && (
        <WorkerPasswordManager
          workerId={selectedWorker.id}
          workerEmail={selectedWorker.email}
          workerName={selectedWorker.name}
          isOpen={passwordManagerOpen}
          onClose={() => {
            setPasswordManagerOpen(false);
            setSelectedWorker(null);
          }}
        />
      )}
    </div>
  );
};
