
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ModificationApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  modification: any;
  onApprovalComplete: () => void;
}

export const ModificationApprovalModal = ({
  isOpen,
  onClose,
  modification,
  onApprovalComplete
}: ModificationApprovalModalProps) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleApprove = async () => {
    setLoading(true);
    try {
      const { error: modError } = await supabase
        .from('invoice_modifications')
        .update({
          approval_status: 'approved',
          customer_approved: true,
          customer_approved_at: new Date().toISOString(),
        })
        .eq('id', modification.id);

      if (modError) throw modError;

      // Update booking with new services and total
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          services: modification.modified_services,
          total_price: modification.modified_total,
          pending_payment_amount: modification.modified_total - modification.original_total,
        })
        .eq('id', modification.booking_id);

      if (bookingError) throw bookingError;

      toast({
        title: "Modification Approved",
        description: "The invoice changes have been approved and applied.",
      });

      onApprovalComplete();
      onClose();
    } catch (error) {
      console.error('Error approving modification:', error);
      toast({
        title: "Error",
        description: "Failed to approve modification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('invoice_modifications')
        .update({
          approval_status: 'rejected',
          customer_approved: false,
          customer_rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', modification.id);

      if (error) throw error;

      toast({
        title: "Modification Rejected",
        description: "The invoice changes have been rejected.",
      });

      onApprovalComplete();
      onClose();
    } catch (error) {
      console.error('Error rejecting modification:', error);
      toast({
        title: "Error",
        description: "Failed to reject modification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!modification) return null;

  const originalServices = Array.isArray(modification.original_services) 
    ? modification.original_services 
    : [];
  const modifiedServices = Array.isArray(modification.modified_services) 
    ? modification.modified_services 
    : [];

  const priceDifference = modification.modified_total - modification.original_total;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <span>Invoice Modification Approval</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Modification Reason */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reason for Modification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {modification.modification_reason || 'No reason provided'}
              </p>
            </CardContent>
          </Card>

          {/* Services Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Services */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center space-x-2">
                  <span>Original Services</span>
                  <Badge variant="outline">${modification.original_total.toFixed(2)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {originalServices.map((service: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${service.price} × {service.quantity}
                      </p>
                    </div>
                    <span className="font-medium">${(service.price * service.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Modified Services */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center space-x-2">
                  <span>Modified Services</span>
                  <Badge variant="outline">${modification.modified_total.toFixed(2)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {modifiedServices.map((service: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${service.price} × {service.quantity}
                      </p>
                    </div>
                    <span className="font-medium">${(service.price * service.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Price Summary */}
          <Card className={priceDifference >= 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className={`h-5 w-5 ${priceDifference >= 0 ? 'text-orange-600' : 'text-green-600'}`} />
                  <span className="font-semibold">Price Difference</span>
                </div>
                <span className={`text-xl font-bold ${priceDifference >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)}
                </span>
              </div>
              {priceDifference > 0 && (
                <p className="text-sm text-orange-600 mt-2">
                  Additional payment will be required upon approval.
                </p>
              )}
              {priceDifference < 0 && (
                <p className="text-sm text-green-600 mt-2">
                  You will receive a refund for this amount.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Rejection Reason (only show if rejecting) */}
          {modification.approval_status === 'pending' && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection (optional)</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please explain why you're rejecting these changes..."
                rows={3}
              />
            </div>
          )}

          {/* Action Buttons */}
          {modification.approval_status === 'pending' && (
            <div className="flex space-x-3 justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={loading}
                className="flex items-center space-x-2"
              >
                <XCircle className="h-4 w-4" />
                <span>Reject Changes</span>
              </Button>
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Approve Changes</span>
              </Button>
            </div>
          )}

          {/* Status Display */}
          {modification.approval_status !== 'pending' && (
            <div className="flex items-center justify-center p-4 rounded-lg border">
              {modification.approval_status === 'approved' ? (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">Modification Approved</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="font-semibold">Modification Rejected</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
