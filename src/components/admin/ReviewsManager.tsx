
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Image, Edit, Trash2, Eye } from 'lucide-react';

export const ReviewsManager = () => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const reviews = [
    {
      id: 'REV001',
      customer: 'John Smith',
      booking: 'BK001',
      rating: 5,
      title: 'Excellent service!',
      comment: 'Alex did an amazing job mounting our TV. Very professional and clean work.',
      status: 'approved',
      hasImages: true,
      date: '2024-01-15',
      worker: 'Alex Thompson'
    },
    {
      id: 'REV002',
      customer: 'Sarah Johnson',
      booking: 'BK002',
      rating: 4,
      title: 'Good work',
      comment: 'TV mounted well, but took a bit longer than expected. Overall satisfied.',
      status: 'pending',
      hasImages: false,
      date: '2024-01-14',
      worker: 'Maria Garcia'
    },
    {
      id: 'REV003',
      customer: 'Mike Davis',
      booking: 'BK003',
      rating: 5,
      title: 'Perfect installation',
      comment: 'David was fantastic! Clean cable management and perfect TV placement.',
      status: 'approved',
      hasImages: true,
      date: '2024-01-13',
      worker: 'David Lee'
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { label: 'Approved', variant: 'default' as const },
      pending: { label: 'Pending', variant: 'secondary' as const },
      rejected: { label: 'Rejected', variant: 'destructive' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-sm font-medium ml-1">{rating}/5</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-gray-600">Average Rating</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">4.8</div>
            <div className="text-sm text-green-600">+0.2 this month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Total Reviews</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">347</div>
            <div className="text-sm text-green-600">+23 this month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Pending Approval</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">12</div>
            <div className="text-sm text-orange-600">Needs attention</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Image className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600">With Images</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">89</div>
            <div className="text-sm text-gray-600">25.6% of reviews</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5" />
            <span>Reviews Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Review ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Booking</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Images</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{review.id}</TableCell>
                    <TableCell>{review.customer}</TableCell>
                    <TableCell>
                      <Button variant="link" className="p-0 h-auto">
                        {review.booking}
                      </Button>
                    </TableCell>
                    <TableCell>{renderStars(review.rating)}</TableCell>
                    <TableCell className="font-medium">{review.title}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate">{review.comment}</p>
                    </TableCell>
                    <TableCell>{review.worker}</TableCell>
                    <TableCell>
                      {review.hasImages ? (
                        <div className="flex items-center space-x-1">
                          <Image className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">Yes</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(review.status)}</TableCell>
                    <TableCell>{review.date}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
