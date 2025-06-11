
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PaymentJobSummaryProps {
  job: any;
}

const PaymentJobSummary = ({ job }: PaymentJobSummaryProps) => {
  return (
    <Card className="bg-gray-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Job Summary</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1 text-sm">
          <div>Job ID: {job.id.slice(0, 8)}</div>
          <div>Customer: {job.customer?.name}</div>
          <div>Outstanding Amount: ${job.pending_payment_amount}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentJobSummary;
