import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Edit, Trash2, Eye, Video, Plus, ExternalLink } from 'lucide-react';
import { BlogPostModal, BlogPostFormData } from './BlogPostModal';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  author: string | null;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  video_id: string | null;
  status: 'draft' | 'published' | 'scheduled';
  views: number;
  publish_date: string | null;
  created_at: string;
  updated_at: string;
}

const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

export const BlogManager = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setPosts((data || []) as BlogPost[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreatePost = () => {
    setSelectedPost(null);
    setShowModal(true);
  };

  const handleEditPost = (post: BlogPost) => {
    setSelectedPost(post);
    setShowModal(true);
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this blog post?')) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', postId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Success', description: 'Blog post deleted' });
    fetchPosts();
  };

  const ensureUniqueSlug = async (base: string, ignoreId?: string): Promise<string> => {
    let candidate = base || 'post';
    let suffix = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const q = supabase.from('blog_posts').select('id').eq('slug', candidate).limit(1);
      const { data } = await q;
      const conflict = (data || []).find((r: any) => r.id !== ignoreId);
      if (!conflict) return candidate;
      suffix += 1;
      candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      if (suffix > 5) return `${base}-${Date.now().toString(36)}`;
    }
  };

  const handleSavePost = async (formData: BlogPostFormData) => {
    const payload: any = {
      title: formData.title,
      category: formData.category || null,
      author: formData.author || 'Admin',
      excerpt: formData.excerpt || null,
      content: formData.content || null,
      cover_image_url: formData.cover_image_url || null,
      video_id: formData.video_id || null,
      status: formData.status,
      publish_date:
        formData.status === 'published'
          ? formData.publish_date || new Date().toISOString().slice(0, 10)
          : formData.publish_date || null,
    };

    if (selectedPost) {
      if (formData.title !== selectedPost.title || (formData.slug && formData.slug !== selectedPost.slug)) {
        const base = slugify(formData.slug || formData.title);
        payload.slug = await ensureUniqueSlug(base, selectedPost.id);
      }
      const { error } = await supabase.from('blog_posts').update(payload).eq('id', selectedPost.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Blog post updated' });
    } else {
      const base = slugify(formData.slug || formData.title);
      payload.slug = await ensureUniqueSlug(base);
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) payload.created_by = userData.user.id;
      const { error } = await supabase.from('blog_posts').insert(payload);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Blog post created' });
    }
    setShowModal(false);
    fetchPosts();
  };

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.category || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: any }> = {
      published: { label: 'Published', variant: 'default' },
      draft: { label: 'Draft', variant: 'secondary' },
      scheduled: { label: 'Scheduled', variant: 'outline' },
    };
    const cfg = map[status] || map.draft;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
  const postsWithVideos = posts.filter((p) => !!p.video_id).length;
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Total Posts</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">{posts.length}</div>
            <div className="text-sm text-green-600">{publishedCount} published</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Total Views</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">{totalViews.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Video className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-muted-foreground">With Videos</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">{postsWithVideos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">Drafts</span>
            </div>
            <div className="text-2xl font-bold text-foreground mt-2">{draftCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Blog Posts Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search blog posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleCreatePost} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Media</TableHead>
                  <TableHead>Publish Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                ) : filteredPosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No posts found</TableCell>
                  </TableRow>
                ) : filteredPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-xs">
                      <p className="font-medium truncate">{post.title}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{post.slug}</TableCell>
                    <TableCell>
                      {post.category && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{post.category}</span>
                      )}
                    </TableCell>
                    <TableCell>{post.author || '—'}</TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Eye className="h-3 w-3" />
                        <span className="text-sm">{(post.views || 0).toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.video_id ? (
                        <div className="flex items-center space-x-1">
                          <Video className="h-4 w-4 text-purple-600" />
                          <span className="text-sm">Video</span>
                        </div>
                      ) : post.cover_image_url ? (
                        <span className="text-sm text-muted-foreground">Image</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Text only</span>
                      )}
                    </TableCell>
                    <TableCell>{post.publish_date || '—'}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        {post.status === 'published' && (
                          <Button variant="outline" size="sm" title="View" asChild>
                            <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleEditPost(post)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeletePost(post.id)} title="Delete">
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

      <BlogPostModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSavePost}
        post={selectedPost}
      />
    </div>
  );
};
