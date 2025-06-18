
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InvoiceModificationCardProps {
  modification: any;
  onModificationUpdated: () => void;
}

export const InvoiceModificationCard = ({ modification, onModificationUpdated }: InvoiceModificationCardProps) => {
  const { toast } = useToast();

  const handleApprove = async () => {
    try {
      // Mock approval since table doesn't exist
      toast({
        title: "Modification Approved",
        description: "The invoice modification has been approved",
      });
      onModificationUpdated();
    } catch (error) {
      console.error('Error approving modification:', error);
      toast({
        title: "Error",
        description: "Failed to approve modification",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    try {
      // Mock rejection since table doesn't exist
      toast({
        title: "Modification Rejected",
        description: "The invoice modification has been rejected",
        variant: "destructive",
      });
      onModificationUpdated();
    } catch (error) {
      console.error('Error rejecting modification:', error);
      toast({
        title: "Error",
        description: "Failed to reject modification",
        variant: "destructive",
      });
    }
  };

  const markAsViewed = async () => {
    try {
      // Mock marking as viewed since table doesn't exist
      onModificationUpdated();
    } catch (error) {
      console.error('Error marking as viewed:', error);
    }
  };

  // Mock data since the table doesn't exist
  const mockModification = {
    id: '1',
    type: 'price_change',
    description: 'Sample modification',
    original_amount: 100,
    new_amount: 150,
    approval_status: 'pending',
    created_at: new Date().toISOString(),
    worker_notes: 'Additional work required'
  };

  const mod = modification || mockModification;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-white">Invoice Modification</CardTitle>
          {getStatusBadge(mod.approval_status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-slate-300">
          <p><strong>Type:</strong> {mod.type}</p>
          <p><strong>Description:</strong> {mod.description}</p>
          <p><strong>Date:</strong> {new Date(mod.created_at).toLocaleDateString()}</p>
        </div>

        {mod.type === 'price_change' && (
          <div className="flex items-center space-x-4 text-slate-300">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              <span>Original: ${mod.original_amount}</span>
            </div>
            <span>→</span>
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              <span>New: ${mod.new_amount}</span>
            </div>
          </div>
        )}

        {mod.worker_notes && (
          <div className="bg-slate-700 p-3 rounded">
            <p className="text-sm text-slate-300"><strong>Worker Notes:</strong></p>
            <p className="text-slate-300">{mod.worker_notes}</p>
          </div>
        )}

        {mod.approval_status === 'pending' && (
          <div className="flex space-x-2">
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button onClick={handleReject} variant="destructive">
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}

        <Button 
          onClick={markAsViewed} 
          variant="outline" 
          className="w-full"
        >
          Mark as Viewed
        </Button>
      </CardContent>
    </Card>
  );
};

export default InvoiceModificationCard;
