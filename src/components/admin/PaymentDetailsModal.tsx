
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Calendar, DollarSign, User, MapPin, Phone, Mail, RefreshCw } from 'lucide-react';
import { RefundBookingModal } from './RefundBookingModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  onSyncComplete?: () => void;
}

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const PaymentDetailsModal = ({ isOpen, onClose, payment, onSyncComplete }: PaymentDetailsModalProps) => {
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  
  if (!payment) return null;

  const handleSyncFromStripe = async () => {
    if (!payment.payment_intent_id && !payment.booking_id) {
      toast({
        title: "Cannot Sync",
        description: "No payment intent ID or booking ID available",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-payment-status', {
        body: {
          payment_intent_id: payment.payment_intent_id,
          booking_id: payment.booking_id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Sync Complete",
          description: `Status updated to ${data.db_payment_status}`,
        });
        onSyncComplete?.();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('[SYNC] Error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || 'Failed to sync with Stripe',
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: 'Completed', variant: 'default' as const },
      pending: { label: 'Pending', variant: 'secondary' as const },
      failed: { label: 'Failed', variant: 'destructive' as const },
      refunded: { label: 'Refunded', variant: 'outline' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.completed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Details - {payment.id}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Payment Status and Amount */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{formatCurrency(payment.amount, payment.currency)}</h3>
                <p className="text-gray-600">Total Amount</p>
              </div>
              <div className="text-right">
                {getStatusBadge(payment.status)}
                <p className="text-sm text-gray-600 mt-1">{formatDate(payment.created_at)}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium ml-2 capitalize">{payment.payment_method || 'Card'}</span>
              </div>
              <div>
                <span className="text-gray-600">Transaction ID:</span>
                <span className="font-medium ml-2">{payment.id?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Customer Information</span>
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-400" />
                <span>{payment.booking?.guest_customer_info?.name || 'Unknown Customer'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>{payment.booking?.guest_customer_info?.email || 'No email'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{payment.booking?.guest_customer_info?.phone || 'No phone'}</span>
              </div>
              {payment.booking?.guest_customer_info?.city && (
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{payment.booking.guest_customer_info.city}, {payment.booking.guest_customer_info.zipcode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Booking Information */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Booking Information</span>
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div>
                <span className="text-gray-600">Booking ID:</span>
                <Button variant="link" className="p-0 h-auto ml-2">
                  {payment.booking_id?.slice(0, 8) || 'N/A'}...
                </Button>
              </div>
              <div>
                <span className="text-gray-600">Payment Intent ID:</span>
                <span className="ml-2 font-mono text-sm">{payment.payment_intent_id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Transaction Date:</span>
                <span className="ml-2">{formatDate(payment.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Payment Method</span>
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div>
                <span className="text-gray-600">Method:</span>
                <span className="ml-2 capitalize">{payment.payment_method || 'Card'}</span>
              </div>
              <div>
                <span className="text-gray-600">Payment Intent ID:</span>
                <span className="ml-2 font-mono text-sm">{payment.payment_intent_id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span className="ml-2">{getStatusBadge(payment.status)}</span>
              </div>
              <div>
                <span className="text-gray-600">Processed At:</span>
                <span className="ml-2">{formatDate(payment.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Transaction Timeline */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Transaction Timeline</span>
            </h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  payment.status === 'completed' || payment.status === 'success' 
                    ? 'bg-green-500' 
                    : payment.status === 'pending' 
                    ? 'bg-yellow-500' 
                    : payment.status === 'failed' 
                    ? 'bg-red-500' 
                    : 'bg-gray-400'
                }`}></div>
                <div>
                  <p className="font-medium">Transaction Status: {payment.status}</p>
                  <p className="text-sm text-gray-600">{formatDate(payment.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Transaction Created</p>
                  <p className="text-sm text-gray-600">{formatDate(payment.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              {payment.payment_intent_id && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSyncFromStripe}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync from Stripe'}
                </Button>
              )}
              {payment.status === 'completed' && payment.booking && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowRefundModal(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Issue Refund
                </Button>
              )}
              <Button variant="outline" size="sm">
                Download Receipt
              </Button>
            </div>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Refund Modal */}
      {payment.booking && (
        <RefundBookingModal
          isOpen={showRefundModal}
          onClose={() => setShowRefundModal(false)}
          booking={payment.booking}
          onRefundComplete={() => {
            setShowRefundModal(false);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
};

export default PaymentDetailsModal;
