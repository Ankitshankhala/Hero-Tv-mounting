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
import { ImageUpload } from './ImageUpload';

export interface NewReviewInput {
  customer_name: string;
  city: string;
  rating: number;
  title: string;
  comment: string;
  image_url: string;
  status: 'approved' | 'pending' | 'rejected';
  is_featured: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (review: NewReviewInput) => void;
}

const empty: NewReviewInput = {
  customer_name: '',
  city: '',
  rating: 5,
  title: '',
  comment: '',
  image_url: '',
  status: 'approved',
  is_featured: false,
};

export const CreateReviewModal = ({ isOpen, onClose, onCreate }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState<NewReviewInput>(empty);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.comment.trim()) {
      toast({ title: 'Customer name and comment are required', variant: 'destructive' });
      return;
    }
    onCreate(form);
    setForm(empty);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Review</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                required
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Austin, TX"
              />
            </div>
          </div>

          <div>
            <Label>Rating *</Label>
            <div className="flex items-center space-x-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, rating: s })} className="p-1">
                  <Star className={`h-6 w-6 ${s <= form.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                </button>
              ))}
              <span className="text-sm ml-2">{form.rating}/5</span>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="comment">Comment *</Label>
            <Textarea
              id="comment"
              required
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              className="min-h-[100px]"
            />
          </div>

          <div>
            <ImageUpload
              currentImageUrl={form.image_url || undefined}
              onImageChange={(url) => setForm({ ...form, image_url: url || '' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: 'approved' | 'pending' | 'rejected') => setForm({ ...form, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="is_featured"
                checked={form.is_featured}
                onCheckedChange={(c) => setForm({ ...form, is_featured: !!c })}
              />
              <Label htmlFor="is_featured">Featured</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-primary hover:opacity-90 text-primary-foreground">Create Review</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
