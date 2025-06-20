
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Review {
  customer: string;
  booking: string;
  rating: number;
  title: string;
  comment: string;
  status: 'approved' | 'pending' | 'rejected';
  hasImages: boolean;
  date: string;
  worker: string;
}

interface CreateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (review: Review) => void;
}

export const CreateReviewModal = ({ isOpen, onClose, onCreate }: CreateReviewModalProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    customer: '',
    booking: '',
    rating: 5,
    title: '',
    comment: '',
    status: 'approved' as 'approved' | 'pending' | 'rejected',
    hasImages: false,
    worker: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer || !formData.title || !formData.comment || !formData.worker) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const newReview: Review = {
      ...formData,
      booking: formData.booking || `BK${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
    };

    onCreate(newReview);
    onClose();
    
    // Reset form
    setFormData({
      customer: '',
      booking: '',
      rating: 5,
      title: '',
      comment: '',
      status: 'approved',
      hasImages: false,
      worker: '',
    });
  };

  const renderStarRating = () => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
            className="p-1"
          >
            <Star
              className={`h-6 w-6 ${
                star <= formData.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
              } hover:text-yellow-400 transition-colors`}
            />
          </button>
        ))}
        <span className="text-sm font-medium ml-2">{formData.rating}/5</span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Review</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer">Customer Name *</Label>
              <Input
                id="customer"
                value={formData.customer}
                onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                placeholder="Enter customer name"
                required
              />
            </div>
            <div>
              <Label htmlFor="worker">Worker Name *</Label>
              <Input
                id="worker"
                value={formData.worker}
                onChange={(e) => setFormData(prev => ({ ...prev, worker: e.target.value }))}
                placeholder="Enter worker name"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="booking">Booking ID (Optional)</Label>
            <Input
              id="booking"
              value={formData.booking}
              onChange={(e) => setFormData(prev => ({ ...prev, booking: e.target.value }))}
              placeholder="Enter booking ID or leave empty for auto-generation"
            />
          </div>

          <div>
            <Label>Rating *</Label>
            {renderStarRating()}
          </div>

          <div>
            <Label htmlFor="title">Review Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter review title"
              required
            />
          </div>

          <div>
            <Label htmlFor="comment">Review Comment *</Label>
            <Textarea
              id="comment"
              value={formData.comment}
              onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
              placeholder="Enter detailed review comment"
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Review Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: 'approved' | 'pending' | 'rejected') => 
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="hasImages"
                checked={formData.hasImages}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, hasImages: checked as boolean }))
                }
              />
              <Label htmlFor="hasImages">Review has images</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              Create Review
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
