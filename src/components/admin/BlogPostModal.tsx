
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BlogPost {
  id?: string;
  title: string;
  category: string;
  content?: string;
  status: 'published' | 'draft' | 'scheduled';
  hasVideo: boolean;
  videoId?: string;
  publishDate?: string;
}

interface BlogPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (post: BlogPost) => void;
  post?: BlogPost | null;
}

export const BlogPostModal = ({ isOpen, onClose, onSave, post }: BlogPostModalProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<BlogPost>({
    title: '',
    category: '',
    content: '',
    status: 'draft',
    hasVideo: false,
    videoId: '',
  });

  useEffect(() => {
    if (post) {
      setFormData(post);
    } else {
      setFormData({
        title: '',
        category: '',
        content: '',
        status: 'draft',
        hasVideo: false,
        videoId: '',
      });
    }
  }, [post]);

  const handleSave = () => {
    if (!formData.title || !formData.category || !formData.content) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.hasVideo && !formData.videoId) {
      toast({
        title: "Error",
        description: "Please provide a video ID if the post has video content",
        variant: "destructive",
      });
      return;
    }

    onSave(formData);
    onClose();
    toast({
      title: "Success",
      description: post ? "Blog post updated successfully" : "Blog post created successfully and added to frontend",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
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
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={formData.content || ''}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter detailed blog post content"
              className="min-h-[200px]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="hasVideo"
              checked={formData.hasVideo}
              onCheckedChange={(checked) => setFormData({ ...formData, hasVideo: checked, videoId: checked ? formData.videoId : '' })}
            />
            <Label htmlFor="hasVideo" className="flex items-center space-x-2">
              <Video className="h-4 w-4" />
              <span>Has Video Content</span>
            </Label>
          </div>

          {formData.hasVideo && (
            <div>
              <Label htmlFor="videoId">YouTube Video ID *</Label>
              <Input
                id="videoId"
                value={formData.videoId || ''}
                onChange={(e) => setFormData({ ...formData, videoId: e.target.value })}
                placeholder="Enter YouTube video ID (e.g., dQw4w9WgXcQ)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Extract the video ID from YouTube URL: https://youtube.com/watch?v=<strong>VIDEO_ID</strong>
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: 'published' | 'draft' | 'scheduled') => setFormData({ ...formData, status: value })}>
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

          {formData.status === 'published' && (
            <div>
              <Label htmlFor="publishDate">Publish Date</Label>
              <Input
                id="publishDate"
                type="date"
                value={formData.publishDate}
                onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            {post ? 'Update' : 'Create'} Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
