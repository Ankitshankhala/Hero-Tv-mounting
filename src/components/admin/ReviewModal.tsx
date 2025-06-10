
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (review: Review) => void;
  review: Review | null;
}

export const ReviewModal = ({ isOpen, onClose, onSave, review }: ReviewModalProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<'approved' | 'pending' | 'rejected'>('pending');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (review) {
      setStatus(review.status);
      setAdminNotes('');
    }
  }, [review]);

  const handleSave = () => {
    if (!review) return;

    const updatedReview = {
      ...review,
      status,
    };

    onSave(updatedReview);
    onClose();
    
    toast({
      title: "Success",
      description: `Review ${status} successfully`,
    });
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

  if (!review) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Details - {review.id}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer</Label>
              <p className="text-sm font-medium">{review.customer}</p>
            </div>
            <div>
              <Label>Booking</Label>
              <p className="text-sm font-medium">{review.booking}</p>
            </div>
            <div>
              <Label>Worker</Label>
              <p className="text-sm font-medium">{review.worker}</p>
            </div>
            <div>
              <Label>Date</Label>
              <p className="text-sm">{review.date}</p>
            </div>
          </div>

          <div>
            <Label>Rating</Label>
            {renderStars(review.rating)}
          </div>

          <div>
            <Label>Title</Label>
            <p className="text-sm font-medium">{review.title}</p>
          </div>

          <div>
            <Label>Comment</Label>
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm">{review.comment}</p>
            </div>
          </div>

          <div>
            <Label>Images</Label>
            <Badge variant={review.hasImages ? "default" : "secondary"}>
              {review.hasImages ? "Has Images" : "No Images"}
            </Badge>
          </div>

          <div>
            <Label htmlFor="status">Review Status</Label>
            <Select value={status} onValueChange={(value: 'approved' | 'pending' | 'rejected') => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
            <Textarea
              id="adminNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add any internal notes about this review..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Update Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
