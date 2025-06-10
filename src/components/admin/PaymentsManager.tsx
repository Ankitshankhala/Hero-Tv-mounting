
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, DollarSign, RefreshCw } from 'lucide-react';

export const PaymentsManager = () => {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const payments = [
    {
      id: 'PAY001',
      bookingId: 'BK001',
      customer: 'John Smith',
      amount: '$149.00',
      fee: '$4.47',
      net: '$144.53',
      method: 'Credit Card',
      status: 'completed',
      date: '2024-01-15',
      stripeId: 'ch_1234567890'
    },
    {
      id: 'PAY002',
      bookingId: 'BK002',
      customer: 'Sarah Johnson',
      amount: '$99.00',
      fee: '$2.97',
      net: '$96.03',
      method: 'Credit Card',
      status: 'completed',
      date: '2024-01-14',
      stripeId: 'ch_0987654321'
    },
    {
      id: 'PAY003',
      bookingId: 'BK005',
      customer: 'Mike Davis',
      amount: '$149.00',
      fee: '$4.47',
      net: '$144.53',
      method: 'Credit Card',
      status: 'refunded',
      date: '2024-01-13',
      stripeId: 'ch_1122334455'
    },
  ];

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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-600">Total Revenue</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">$12,460</div>
            <div className="text-sm text-green-600">+20.1% from last month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600">Stripe Fees</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">$373.80</div>
            <div className="text-sm text-gray-600">3% of total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-gray-600">Refunds</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">$298</div>
            <div className="text-sm text-gray-600">2 transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-gray-600">Net Income</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">$11,788</div>
            <div className="text-sm text-green-600">After fees & refunds</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Transactions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Stripe Fee</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.id}</TableCell>
                    <TableCell>
                      <Button variant="link" className="p-0 h-auto">
                        {payment.bookingId}
                      </Button>
                    </TableCell>
                    <TableCell>{payment.customer}</TableCell>
                    <TableCell className="font-medium">{payment.amount}</TableCell>
                    <TableCell className="text-red-600">{payment.fee}</TableCell>
                    <TableCell className="font-medium text-green-600">{payment.net}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>{payment.date}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
