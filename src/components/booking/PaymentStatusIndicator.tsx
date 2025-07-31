import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface PaymentStatusIndicatorProps {
  status: 'pending' | 'authorized' | 'captured' | 'failed';
  amount?: number;
  className?: string;
}

export const PaymentStatusIndicator = ({ status, amount, className = '' }: PaymentStatusIndicatorProps) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'authorized':
        return {
          icon: CreditCard,
          text: 'Payment Authorized',
          description: 'Will be charged when service is completed',
          variant: 'secondary' as const,
          className: 'bg-blue-50 text-blue-700 border-blue-200'
        };
      case 'captured':
        return {
          icon: CheckCircle,
          text: 'Payment Charged',
          description: 'Payment completed successfully',
          variant: 'default' as const,
          className: 'bg-green-50 text-green-700 border-green-200'
        };
      case 'failed':
        return {
          icon: AlertCircle,
          text: 'Payment Failed',
          description: 'Payment could not be processed',
          variant: 'destructive' as const,
          className: 'bg-red-50 text-red-700 border-red-200'
        };
      default:
        return {
          icon: Clock,
          text: 'Payment Pending',
          description: 'Waiting for payment authorization',
          variant: 'outline' as const,
          className: 'bg-gray-50 text-gray-700 border-gray-200'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-lg border ${config.className} ${className}`}>
      <Icon className="h-5 w-5" />
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-sm">{config.text}</span>
          {amount && (
            <Badge variant={config.variant} className="text-xs">
              ${amount.toFixed(2)}
            </Badge>
          )}
        </div>
        <p className="text-xs opacity-75 mt-1">{config.description}</p>
      </div>
    </div>
  );
};