
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Image, Edit, Trash2, Eye, Plus } from 'lucide-react';
import { ReviewModal } from './ReviewModal';
import { CreateReviewModal } from './CreateReviewModal';
import { useToast } from '@/hooks/use-toast';
import { useReviewsData } from '@/hooks/useReviewsData';

interface Review {
  id: string;
  customer: string;
  booking: string;
  rating: number;
  title: string;
  comment: string;
  status: 'approved' | 'pending' | 'rejected';
  hasImages: boolean;
  date: string;
  worker: string;
  imageUrl?: string;
}

export const ReviewsManager = () => {
  const { toast } = useToast();
  const { adminReviews, addAdminReview, updateAdminReview, deleteAdminReview } = useReviewsData();
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  const handleViewReview = (review: Review) => {
    setSelectedReview(review);
    setShowModal(true);
  };

  const handleEditReview = (review: Review) => {
    setSelectedReview(review);
    setShowModal(true);
  };

  const handleDeleteReview = (reviewId: string) => {
    if (window.confirm('Are you sure you want to delete this review?')) {
      deleteAdminReview(reviewId);
      toast({
        title: "Success",
        description: "Review deleted successfully",
      });
    }
  };

  const handleSaveReview = (updatedReview: Review) => {
    updateAdminReview(updatedReview);
    toast({
      title: "Success",
      description: "Review updated successfully",
    });
  };

  const handleCreateReview = (newReview: Omit<Review, 'id'>) => {
    // Add to both admin panel and frontend
    addAdminReview(newReview);
    
    toast({
      title: "Success",
      description: "Review created successfully and added to frontend",
    });
  };

  const filteredReviews = adminReviews.filter(review => {
    const matchesSearch = review.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.comment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || review.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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
            <div className="text-2xl font-bold text-gray-900 mt-2">{adminReviews.length}</div>
            <div className="text-sm text-green-600">+23 this month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Pending Approval</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{adminReviews.filter(r => r.status === 'pending').length}</div>
            <div className="text-sm text-orange-600">Needs attention</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Image className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600">With Images</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{adminReviews.filter(r => r.hasImages).length}</div>
            <div className="text-sm text-gray-600">25.6% of reviews</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5" />
              <span>Reviews Management</span>
            </CardTitle>
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add New Review
            </Button>
          </div>
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
                {filteredReviews.map((review) => (
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewReview(review)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditReview(review)}
                          title="Edit Status"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteReview(review.id)}
                          title="Delete"
                        >
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

      <ReviewModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveReview}
        review={selectedReview}
      />

      <CreateReviewModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateReview}
      />
    </div>
  );
};
