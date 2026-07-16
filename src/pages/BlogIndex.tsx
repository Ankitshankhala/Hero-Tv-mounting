import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/SEO';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface Post {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  video_id: string | null;
  publish_date: string | null;
  created_at: string;
}

const BlogIndex = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('blog_posts')
        .select('id,title,slug,category,excerpt,cover_image_url,video_id,publish_date,created_at')
        .eq('status', 'published')
        .or(`publish_date.is.null,publish_date.lte.${today}`)
        .order('publish_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (data) setPosts(data as Post[]);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <SEO title="Blog | Hero TV Mounting" description="Pro tips, tutorials, and guides for TV mounting and home installation." />
      <Header />
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Blog</h1>
        {loading ? (
          <div className="text-slate-400">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="text-slate-400">No posts yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-blue-500 transition">
                <div className="aspect-video bg-slate-900 relative">
                  {post.video_id ? (
                    <img src={`https://img.youtube.com/vi/${post.video_id}/hqdefault.jpg`} alt={post.title} className="w-full h-full object-cover" />
                  ) : post.cover_image_url ? (
                    <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                  )}
                </div>
                <div className="p-5">
                  {post.category && <div className="text-xs uppercase tracking-wide text-blue-400 mb-2">{post.category}</div>}
                  <h2 className="text-lg font-semibold mb-2 line-clamp-2">{post.title}</h2>
                  <p className="text-sm text-slate-400 line-clamp-3">{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default BlogIndex;
