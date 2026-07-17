import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export interface BlogPostFormData {
  id?: string;
  title: string;
  slug?: string;
  category: string;
  author?: string;
  excerpt?: string;
  content: string;
  cover_image_url?: string;
  video_id?: string;
  status: 'draft' | 'published' | 'scheduled';
  publish_date?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (post: BlogPostFormData) => void;
  post?: any | null;
}

const empty: BlogPostFormData = {
  title: '',
  slug: '',
  category: '',
  author: 'Admin',
  excerpt: '',
  content: '',
  cover_image_url: '',
  video_id: '',
  status: 'draft',
  publish_date: '',
};

export const BlogPostModal = ({ isOpen, onClose, onSave, post }: Props) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<BlogPostFormData>(empty);

  useEffect(() => {
    if (post) {
      setFormData({
        id: post.id,
        title: post.title || '',
        slug: post.slug || '',
        category: post.category || '',
        author: post.author || 'Admin',
        excerpt: post.excerpt || '',
        content: post.content || '',
        cover_image_url: post.cover_image_url || '',
        video_id: post.video_id || '',
        status: post.status || 'draft',
        publish_date: post.publish_date || '',
      });
    } else {
      setFormData(empty);
    }
  }, [post, isOpen]);

  const handleSave = () => {
    if (!formData.title || !formData.content) {
      toast({ title: 'Error', description: 'Title and content are required', variant: 'destructive' });
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post ? 'Edit Blog Post' : 'Create New Blog Post'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter blog post title"
            />
          </div>

          {post && (
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug || ''}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="url-friendly-slug"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave unchanged to keep current slug; changing title regenerates it.</p>
            </div>
          )}

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pro Tips">Pro Tips</SelectItem>
                <SelectItem value="Tutorial">Tutorial</SelectItem>
                <SelectItem value="Education">Education</SelectItem>
                <SelectItem value="News">News</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={formData.author || ''}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              placeholder="Author name"
            />
          </div>

          <div>
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt || ''}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              placeholder="Short summary (used on cards and SEO)"
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Full post content (plain text or markdown)"
              className="min-h-[200px]"
            />
          </div>

          <div>
            <Label htmlFor="cover">Cover Image URL</Label>
            <Input
              id="cover"
              value={formData.cover_image_url || ''}
              onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="videoId">YouTube Video ID (optional)</Label>
            <Input
              id="videoId"
              value={formData.video_id || ''}
              onChange={(e) => setFormData({ ...formData, video_id: e.target.value })}
              placeholder="e.g. dQw4w9WgXcQ"
            />
            <p className="text-xs text-muted-foreground mt-1">If provided, video is embedded instead of the cover image.</p>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(v: 'draft' | 'published' | 'scheduled') => setFormData({ ...formData, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="publishDate">Publish Date</Label>
            <Input
              id="publishDate"
              type="date"
              value={formData.publish_date || ''}
              onChange={(e) => setFormData({ ...formData, publish_date: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            {post ? 'Update' : 'Create'} Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
