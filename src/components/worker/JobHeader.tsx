
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface JobHeaderProps {
  job: any;
}

const JobHeader = ({ job }: JobHeaderProps) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'secondary' as const },
      confirmed: { label: 'Confirmed', variant: 'default' as const },
      'in_progress': { label: 'In Progress', variant: 'secondary' as const },
      completed: { label: 'Completed', variant: 'outline' as const },
      cancelled: { label: 'Cancelled', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getServicesDisplay = (services: any) => {
    if (Array.isArray(services)) {
      return services.map(s => `${s.name} (${s.quantity})`).join(', ');
    }
    return 'Service details';
  };

  const calculateFinalPrice = () => {
    const basePrice = job.total_price || 0;
    const pendingAmount = job.pending_payment_amount || 0;
    return basePrice + pendingAmount;
  };

  const finalPrice = calculateFinalPrice();

  return (
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-lg font-semibold text-white">
          {job.customer?.name || 'Customer'}
        </h3>
        <p className="text-slate-400">Job #{job.id.slice(0, 8)} • {getServicesDisplay(job.services)}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center space-x-2">
          {getStatusBadge(job.status)}
          {job.has_modifications && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400">
              Modified
            </Badge>
          )}
        </div>
        <div className="mt-1">
          {job.has_modifications && job.pending_payment_amount !== 0 ? (
            <div>
              <p className="text-sm text-slate-400">Original: ${job.total_price}</p>
              <p className={`text-sm ${job.pending_payment_amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {job.pending_payment_amount > 0 ? 'Additional' : 'Discount'}: ${Math.abs(job.pending_payment_amount).toFixed(2)}
              </p>
              <p className="text-xl font-bold text-white">Final: ${finalPrice.toFixed(2)}</p>
            </div>
          ) : (
            <p className="text-xl font-bold text-white">${job.total_price}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobHeader;
