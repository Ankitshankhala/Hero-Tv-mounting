
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Send, RefreshCw, Loader2 } from 'lucide-react';
import { useSmsLogs } from '@/hooks/useSmsLogs';

export const SMSLogsManager = () => {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { smsLogs, stats, loading, error, refetch } = useSmsLogs();

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    return smsLogs.filter(log => {
      const matchesSearch = searchTerm === '' || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.recipient_number.includes(searchTerm) ||
        log.message_type.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filterType === 'all' || 
        (filterType === 'sent' && log.status === 'sent') ||
        (filterType === 'failed' && log.status === 'failed');

      return matchesSearch && matchesFilter;
    });
  }, [smsLogs, searchTerm, filterType]);

  const getStatusBadge = (status: 'sent' | 'failed' | 'pending') => {
    const statusConfig = {
      sent: { label: 'Sent', variant: 'default' as const },
      failed: { label: 'Failed', variant: 'destructive' as const },
      pending: { label: 'Pending', variant: 'secondary' as const },
    };
    
    const config = statusConfig[status] || statusConfig.sent;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getMessageType = (message: string) => {
    if (message.includes('assigned')) return 'Job Assignment';
    if (message.includes('reminder')) return 'Reminder';
    if (message.includes('rescheduled')) return 'Job Update';
    if (message.includes('completion')) return 'Completion';
    return 'Notification';
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
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.sentToday}
            </div>
            <div className="text-sm text-gray-600">Messages today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-600">Delivery Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${stats.deliveryRate}%`}
            </div>
            <div className="text-sm text-green-600">
              {stats.deliveryRate >= 95 ? 'Excellent' : stats.deliveryRate >= 90 ? 'Good' : 'Needs attention'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Monthly Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.monthlyTotal}
            </div>
            <div className="text-sm text-gray-600">Messages this month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Failed Messages</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.failedCount}
            </div>
            <div className="text-sm text-red-600">
              {stats.failedCount === 0 ? 'No failures' : `${((stats.failedCount / (stats.monthlyTotal || 1)) * 100).toFixed(1)}% failure rate`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>SMS Logs</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
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
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="sent">Sent Messages</SelectItem>
                <SelectItem value="failed">Failed Messages</SelectItem>
              </SelectContent>
            </Select>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">Loading SMS logs...</p>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-sm text-red-600">Error: {error}</p>
                      <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
                        Try Again
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-sm text-gray-500">No SMS logs found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((sms) => (
                    <TableRow key={sms.id}>
                      <TableCell className="font-medium">
                        {sms.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{sms.recipient_name || 'Unknown'}</TableCell>
                      <TableCell className="font-mono text-sm">{sms.recipient_number}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          {sms.message_type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate" title={sms.message}>
                          {sms.message}
                        </p>
                      </TableCell>
                      <TableCell>{getStatusBadge(sms.status)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {formatTimestamp(sms.sent_at || sms.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
