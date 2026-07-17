import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  video_id: string | null;
  publish_date: string | null;
}

export const BlogSection = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id,title,slug,category,excerpt,cover_image_url,video_id,publish_date')
        .eq('status', 'published')
        .or(`publish_date.is.null,publish_date.lte.${today}`)
        .order('publish_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (!error && data) setPosts(data as BlogPost[]);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  if (loading || posts.length === 0) return null;

  const renderMedia = (post: BlogPost) => {
    if (post.video_id) {
      return (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${post.video_id}`}
          title={post.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
    if (post.cover_image_url) {
      return <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" decoding="async" width="800" height="600" />;
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        <div className="text-blue-400/70 text-sm font-semibold">{post.category || 'Blog'}</div>
      </div>
    );
  };

  const renderThumb = (post: BlogPost) => {
    if (post.cover_image_url) {
      return <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />;
    }
    if (post.video_id) {
      return <img src={`https://img.youtube.com/vi/${post.video_id}/mqdefault.jpg`} alt={post.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />;
    }
    return <div className="w-full h-full bg-slate-800 flex items-center justify-center text-blue-400 text-xs">{post.category || 'Blog'}</div>;
  };

  return (
    <section className="py-10 md:py-16 bg-slate-900/30">
      <div className="container mx-auto px-4">
        <div className="mb-6 md:mb-10 md:text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-white">Pro Tips</h2>
        </div>

        {/* Mobile: horizontal snap carousel of compact cards */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="snap-start shrink-0 w-[80%] bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden active:opacity-80"
              >
                <div className="aspect-[16/9] bg-slate-900">{renderThumb(post)}</div>
                <div className="p-3">
                  {post.category && (
                    <div className="text-[10px] uppercase tracking-wide text-blue-400 mb-1">{post.category}</div>
                  )}
                  <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1">{post.title}</h3>
                  {post.excerpt && (
                    <p className="text-xs text-slate-400 line-clamp-1 mb-2">{post.excerpt}</p>
                  )}
                  <span className="text-xs font-medium text-blue-400">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop: equal-height card grid */}
        <div className="hidden md:block">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {posts.slice(0, 9).map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group flex flex-col bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/60 transition-colors"
              >
                <div className="aspect-[4/3] bg-slate-900 overflow-hidden">{renderThumb(post)}</div>
                <div className="p-5 flex flex-col flex-1">
                  {post.category && (
                    <div className="text-xs uppercase tracking-wide text-blue-400 mb-2">{post.category}</div>
                  )}
                  <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-300 transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-sm text-slate-400 line-clamp-2 flex-1">{post.excerpt}</p>
                  )}
                  <span className="mt-4 text-blue-400 text-sm font-medium">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
