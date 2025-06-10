
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Calendar, DollarSign, User, MapPin, Phone, Mail } from 'lucide-react';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
}

const PaymentDetailsModal = ({ isOpen, onClose, payment }: PaymentDetailsModalProps) => {
  if (!payment) return null;

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
                <h3 className="font-semibold text-lg">{payment.amount}</h3>
                <p className="text-gray-600">Total Amount</p>
              </div>
              <div className="text-right">
                {getStatusBadge(payment.status)}
                <p className="text-sm text-gray-600 mt-1">{payment.date}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Stripe Fee:</span>
                <span className="font-medium text-red-600 ml-2">{payment.fee}</span>
              </div>
              <div>
                <span className="text-gray-600">Net Amount:</span>
                <span className="font-medium text-green-600 ml-2">{payment.net}</span>
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
                <span>{payment.customer}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span>customer@example.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>+1 (555) 123-4567</span>
              </div>
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
                  {payment.bookingId}
                </Button>
              </div>
              <div>
                <span className="text-gray-600">Service:</span>
                <span className="ml-2">TV Mounting Service</span>
              </div>
              <div>
                <span className="text-gray-600">Service Date:</span>
                <span className="ml-2">January 16, 2024</span>
              </div>
              <div>
                <span className="text-gray-600">Address:</span>
                <span className="ml-2">123 Main St, Austin, TX 78701</span>
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
                <span className="ml-2">{payment.method}</span>
              </div>
              <div>
                <span className="text-gray-600">Stripe Transaction ID:</span>
                <span className="ml-2 font-mono text-sm">{payment.stripeId}</span>
              </div>
              <div>
                <span className="text-gray-600">Processed At:</span>
                <span className="ml-2">{payment.date} at 2:45 PM</span>
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
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Payment Completed</p>
                  <p className="text-sm text-gray-600">{payment.date} at 2:45 PM</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Payment Initiated</p>
                  <p className="text-sm text-gray-600">{payment.date} at 2:44 PM</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Booking Created</p>
                  <p className="text-sm text-gray-600">{payment.date} at 2:30 PM</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              {payment.status === 'completed' && (
                <Button variant="outline" size="sm">
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
    </Dialog>
  );
};

export default PaymentDetailsModal;
