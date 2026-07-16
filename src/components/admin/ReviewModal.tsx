import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Star } from 'lucide-react';

export interface AdminReview {
  id: string;
  booking_id: string | null;
  customer_id: string | null;
  worker_id: string | null;
  customer_name: string;
  city: string | null;
  rating: number;
  title: string | null;
  comment: string;
  image_url: string | null;
  status: 'approved' | 'pending' | 'rejected';
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (review: AdminReview) => void;
  review: AdminReview | null;
}

export const ReviewModal = ({ isOpen, onClose, onSave, review }: Props) => {
  const [draft, setDraft] = useState<AdminReview | null>(review);

  useEffect(() => { setDraft(review); }, [review]);

  if (!draft) return null;

  const renderStars = (rating: number, onChange: (n: number) => void) => (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} className="p-1">
          <Star className={`h-6 w-6 ${s <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
        </button>
      ))}
      <span className="text-sm ml-1">{rating}/5</span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review — {draft.customer_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {draft.image_url && (
            <img src={draft.image_url} alt="review" className="w-full max-h-64 object-cover rounded-md" />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer</Label>
              <p className="text-sm font-medium">{draft.customer_name}</p>
            </div>
            <div>
              <Label>City</Label>
              <p className="text-sm">{draft.city || '—'}</p>
            </div>
            <div>
              <Label>Booking</Label>
              <p className="text-xs font-mono">{draft.booking_id || '—'}</p>
            </div>
            <div>
              <Label>Submitted</Label>
              <p className="text-sm">{new Date(draft.created_at).toLocaleString()}</p>
            </div>
          </div>

          <div>
            <Label>Rating</Label>
            {renderStars(draft.rating, (n) => setDraft({ ...draft, rating: n }))}
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="comment">Comment</Label>
            <Textarea
              id="comment"
              value={draft.comment}
              onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
              className="min-h-[120px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v: 'approved' | 'pending' | 'rejected') => setDraft({ ...draft, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="featured"
                checked={draft.is_featured}
                onCheckedChange={(c) => setDraft({ ...draft, is_featured: !!c })}
              />
              <Label htmlFor="featured">Featured</Label>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
