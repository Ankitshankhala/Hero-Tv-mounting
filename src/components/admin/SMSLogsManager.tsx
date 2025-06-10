
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Send } from 'lucide-react';

export const SMSLogsManager = () => {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const smsLogs = [
    {
      id: 'SMS001',
      recipient: 'Alex Thompson',
      phone: '(555) 111-2222',
      type: 'job_assignment',
      message: 'New job assigned: TV Mounting at 123 Main St, 2:00 PM',
      status: 'delivered',
      timestamp: '2024-01-15 13:45:00',
      cost: '$0.0075'
    },
    {
      id: 'SMS002',
      recipient: 'Maria Garcia',
      phone: '(555) 333-4444',
      type: 'reminder',
      message: 'Reminder: Job at 456 Oak Ave in 30 minutes',
      status: 'delivered',
      timestamp: '2024-01-15 15:30:00',
      cost: '$0.0075'
    },
    {
      id: 'SMS003',
      recipient: 'David Lee',
      phone: '(555) 555-6666',
      type: 'job_update',
      message: 'Job rescheduled: New time 4:00 PM tomorrow',
      status: 'failed',
      timestamp: '2024-01-15 16:15:00',
      cost: '$0.0000'
    },
    {
      id: 'SMS004',
      recipient: 'Alex Thompson',
      phone: '(555) 111-2222',
      type: 'completion',
      message: 'Please confirm job completion and update status',
      status: 'delivered',
      timestamp: '2024-01-15 17:00:00',
      cost: '$0.0075'
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      delivered: { label: 'Delivered', variant: 'default' as const },
      pending: { label: 'Pending', variant: 'secondary' as const },
      failed: { label: 'Failed', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.delivered;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const typeConfig = {
      job_assignment: 'Job Assignment',
      reminder: 'Reminder',
      job_update: 'Job Update',
      completion: 'Completion Request',
    };
    return typeConfig[type as keyof typeof typeConfig] || type;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Send className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600">SMS Sent Today</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">47</div>
            <div className="text-sm text-green-600">+15% from yesterday</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-600">Delivery Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">98.3%</div>
            <div className="text-sm text-green-600">Excellent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Monthly Cost</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">$45.60</div>
            <div className="text-sm text-gray-600">6,080 messages</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Failed Messages</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">12</div>
            <div className="text-sm text-red-600">1.7% failure rate</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>SMS Logs</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search SMS logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="job_assignment">Job Assignment</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="job_update">Job Update</SelectItem>
                <SelectItem value="completion">Completion</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Send SMS
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SMS ID</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smsLogs.map((sms) => (
                  <TableRow key={sms.id}>
                    <TableCell className="font-medium">{sms.id}</TableCell>
                    <TableCell>{sms.recipient}</TableCell>
                    <TableCell className="font-mono text-sm">{sms.phone}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        {getTypeLabel(sms.type)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate">{sms.message}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(sms.status)}</TableCell>
                    <TableCell className="text-sm font-mono">{sms.timestamp}</TableCell>
                    <TableCell className="text-sm">{sms.cost}</TableCell>
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
