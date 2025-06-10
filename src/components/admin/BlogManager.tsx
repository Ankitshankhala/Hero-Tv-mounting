import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Edit, Trash2, Eye, Video, Plus } from 'lucide-react';
import { BlogPostModal } from './BlogPostModal';
import { useToast } from '@/hooks/use-toast';

interface BlogPost {
  id: string;
  title: string;
  category: string;
  author: string;
  status: 'published' | 'draft' | 'scheduled';
  views: number;
  hasVideo: boolean;
  publishDate: string | null;
  lastModified: string;
  content?: string;
}

export const BlogManager = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([
    {
      id: 'POST001',
      title: 'How to Choose the Perfect TV Wall Mount',
      category: 'Pro Tips',
      author: 'Admin',
      status: 'published',
      views: 1247,
      hasVideo: true,
      publishDate: '2024-01-10',
      lastModified: '2024-01-12',
      content: 'Content for choosing the perfect TV wall mount...'
    },
    {
      id: 'POST002',
      title: 'Cable Management: Clean Installation Guide',
      category: 'Tutorial',
      author: 'Admin',
      status: 'draft',
      views: 0,
      hasVideo: false,
      publishDate: null,
      lastModified: '2024-01-14',
      content: 'Content for cable management guide...'
    },
    {
      id: 'POST003',
      title: 'Best TV Heights for Different Room Layouts',
      category: 'Pro Tips',
      author: 'Admin',
      status: 'published',
      views: 892,
      hasVideo: true,
      publishDate: '2024-01-08',
      lastModified: '2024-01-08',
      content: 'Content for TV heights guide...'
    },
    {
      id: 'POST004',
      title: 'Understanding Different Wall Types for TV Mounting',
      category: 'Education',
      author: 'Admin',
      status: 'published',
      views: 634,
      hasVideo: false,
      publishDate: '2024-01-05',
      lastModified: '2024-01-06',
      content: 'Content for wall types guide...'
    },
  ]);

  const handleCreatePost = () => {
    setSelectedPost(null);
    setShowModal(true);
  };

  const handleEditPost = (post: BlogPost) => {
    setSelectedPost(post);
    setShowModal(true);
  };

  const handleDeletePost = (postId: string) => {
    if (window.confirm('Are you sure you want to delete this blog post?')) {
      setBlogPosts(prev => prev.filter(post => post.id !== postId));
      toast({
        title: "Success",
        description: "Blog post deleted successfully",
      });
    }
  };

  const handleSavePost = (postData: any) => {
    if (selectedPost) {
      // Update existing post
      setBlogPosts(prev => prev.map(post => 
        post.id === selectedPost.id 
          ? { 
              ...post, 
              ...postData, 
              lastModified: new Date().toISOString().split('T')[0],
              publishDate: postData.status === 'published' ? (postData.publishDate || new Date().toISOString().split('T')[0]) : null
            }
          : post
      ));
    } else {
      // Create new post
      const newPost: BlogPost = {
        id: `POST${String(blogPosts.length + 1).padStart(3, '0')}`,
        author: 'Admin',
        views: 0,
        lastModified: new Date().toISOString().split('T')[0],
        publishDate: postData.status === 'published' ? (postData.publishDate || new Date().toISOString().split('T')[0]) : null,
        ...postData,
      };
      setBlogPosts(prev => [...prev, newPost]);
    }
  };

  const filteredPosts = blogPosts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      published: { label: 'Published', variant: 'default' as const },
      draft: { label: 'Draft', variant: 'secondary' as const },
      scheduled: { label: 'Scheduled', variant: 'outline' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-600">Total Posts</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">{blogPosts.length}</div>
            <div className="text-sm text-green-600">+3 this month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-600">Total Views</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">15,420</div>
            <div className="text-sm text-green-600">+12% this month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Video className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-gray-600">With Videos</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">12</div>
            <div className="text-sm text-gray-600">50% of posts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Avg. Views/Post</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">642</div>
            <div className="text-sm text-green-600">Good engagement</div>
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
                  <TableHead>Post ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Media</TableHead>
                  <TableHead>Publish Date</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.id}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="font-medium truncate">{post.title}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {post.category}
                      </span>
                    </TableCell>
                    <TableCell>{post.author}</TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Eye className="h-3 w-3" />
                        <span className="text-sm">{post.views.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.hasVideo ? (
                        <div className="flex items-center space-x-1">
                          <Video className="h-4 w-4 text-purple-600" />
                          <span className="text-sm">Video</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Text only</span>
                      )}
                    </TableCell>
                    <TableCell>{post.publishDate || 'Not published'}</TableCell>
                    <TableCell>{post.lastModified}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm" title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEditPost(post)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeletePost(post.id)}
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

      <BlogPostModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSavePost}
        post={selectedPost}
      />
    </div>
  );
};
