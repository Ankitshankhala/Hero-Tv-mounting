import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const REVIEW_PHOTO_BUCKET = 'temp-uploads';

export default function SubmitReview() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const uploadPhoto = async (): Promise<string | null> => {
    if (!file) return null;
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `reviews/${bookingId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(REVIEW_PHOTO_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) return null;
      const { data } = supabase.storage.from(REVIEW_PHOTO_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId) return;
    if (!comment.trim()) {
      toast({ title: 'Please add a comment', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const image_url = await uploadPhoto();
      const { data, error } = await supabase.functions.invoke('submit-review', {
        body: { booking_id: bookingId, rating, title: title || null, comment, image_url },
      });
      if (error) {
        toast({ title: 'Could not submit review', description: error.message, variant: 'destructive' });
      } else if (data?.success) {
        setDone(data.message || 'Thanks! Your review has been submitted and will appear after approval.');
      } else {
        toast({ title: 'Could not submit review', description: data?.error || 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Leave a Review</CardTitle>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="text-center space-y-4 py-6">
                <div className="text-2xl">🎉</div>
                <p className="text-slate-700">{done}</p>
                <Link to="/">
                  <Button>Back to Home</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label>Your rating</Label>
                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseEnter={() => setHover(s)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => setRating(s)}
                        className="p-1"
                      >
                        <Star
                          className={`h-8 w-8 transition-colors ${
                            s <= (hover || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-gray-600">{rating}/5</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sums up your experience" />
                </div>

                <div>
                  <Label htmlFor="comment">Your review *</Label>
                  <Textarea
                    id="comment"
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us how it went…"
                    className="min-h-[120px]"
                  />
                </div>

                <div>
                  <Label htmlFor="photo" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Photo (optional)
                  </Label>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <p className="text-xs text-gray-500">
                  Your review will appear publicly after admin approval.
                </p>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Submit Review
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
