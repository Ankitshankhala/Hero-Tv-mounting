
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface InvoiceModificationCardProps {
  modification: {
    id: string;
    booking_id: string;
    original_services: Service[];
    modified_services: Service[];
    original_total: number;
    modified_total: number;
    modification_reason: string;
    approval_status: string;
    created_at: string;
    customer_viewed_at?: string;
  };
  onModificationUpdated: () => void;
}

const InvoiceModificationCard = ({ modification, onModificationUpdated }: InvoiceModificationCardProps) => {
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const { toast } = useToast();

  const handleApprove = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('invoice_modifications')
        .update({
          approval_status: 'approved',
          customer_approved_at: new Date().toISOString(),
          customer_viewed_at: new Date().toISOString()
        })
        .eq('id', modification.id);

      if (error) throw error;

      // Update the booking with the new total
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          total_price: modification.modified_total,
          services: modification.modified_services as any,
          pending_payment_amount: modification.modified_total - modification.original_total
        })
        .eq('id', modification.booking_id);

      if (bookingError) throw bookingError;

      toast({
        title: "Success",
        description: "Invoice modification approved successfully",
      });

      onModificationUpdated();
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
          customer_rejected_at: new Date().toISOString(),
          customer_viewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', modification.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invoice modification rejected",
      });

      onModificationUpdated();
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

  const markAsViewed = async () => {
    if (!modification.customer_viewed_at) {
      await supabase
        .from('invoice_modifications')
        .update({ customer_viewed_at: new Date().toISOString() })
        .eq('id', modification.id);
    }
  };

  React.useEffect(() => {
    markAsViewed();
  }, []);

  const getStatusBadge = () => {
    switch (modification.approval_status) {
      case 'approved':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
    }
  };

  const priceDifference = modification.modified_total - modification.original_total;

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-white">Invoice Modification Request</CardTitle>
          {getStatusBadge()}
        </div>
        <p className="text-slate-400 text-sm">
          Requested on {new Date(modification.created_at).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {modification.modification_reason && (
          <div>
            <h4 className="text-white font-medium mb-2">Reason for Modification:</h4>
            <p className="text-slate-300 bg-slate-700 p-3 rounded">{modification.modification_reason}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-white font-medium mb-3">Original Services:</h4>
            <div className="space-y-2">
              {modification.original_services.map((service: Service, index: number) => (
                <div key={index} className="flex justify-between bg-slate-700 p-2 rounded">
                  <span className="text-slate-300">{service.name} x{service.quantity}</span>
                  <span className="text-white">${(service.price * service.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-white bg-slate-600 p-2 rounded">
                <span>Original Total:</span>
                <span>${modification.original_total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-white font-medium mb-3">Modified Services:</h4>
            <div className="space-y-2">
              {modification.modified_services.map((service: Service, index: number) => (
                <div key={index} className="flex justify-between bg-slate-700 p-2 rounded">
                  <span className="text-slate-300">{service.name} x{service.quantity}</span>
                  <span className="text-white">${(service.price * service.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-white bg-slate-600 p-2 rounded">
                <span>New Total:</span>
                <span>${modification.modified_total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 bg-slate-700 rounded">
          <DollarSign className="h-5 w-5 mr-2 text-blue-400" />
          <span className="text-white font-medium">
            Price Change: 
            <span className={priceDifference >= 0 ? 'text-red-400 ml-2' : 'text-green-400 ml-2'}>
              {priceDifference >= 0 ? '+' : ''}${priceDifference.toFixed(2)}
            </span>
          </span>
        </div>

        {modification.approval_status === 'pending' && (
          <div className="space-y-4">
            {!showRejectionForm ? (
              <div className="flex gap-3">
                <Button 
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Changes
                </Button>
                <Button 
                  onClick={() => setShowRejectionForm(true)}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Changes
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="Please provide a reason for rejecting these changes..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
                <div className="flex gap-3">
                  <Button 
                    onClick={handleReject}
                    disabled={loading || !rejectionReason.trim()}
                    variant="destructive"
                    className="flex-1"
                  >
                    Confirm Rejection
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowRejectionForm(false);
                      setRejectionReason('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceModificationCard;
