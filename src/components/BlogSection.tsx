import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
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
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600/20 to-purple-600/20">
        <div className="text-white/60 text-center">
          <div className="text-2xl font-bold mb-2">{post.category || 'Blog'}</div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-16 bg-slate-900/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Pro Tips</h2>
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-6 pr-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                  <div className="grid grid-cols-2 h-80">
                    <div className="relative bg-slate-900">{renderMedia(post)}</div>
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      {post.category && (
                        <div className="text-xs uppercase tracking-wide text-blue-400 mb-2">{post.category}</div>
                      )}
                      <h3 className="text-xl md:text-2xl font-bold text-white mb-4 line-clamp-2">{post.title}</h3>
                      <ScrollArea className="flex-1">
                        <p className="text-sm md:text-base text-slate-300 leading-relaxed pr-4">{post.excerpt}</p>
                      </ScrollArea>
                      <Link to={`/blog/${post.slug}`} className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium">
                        Read more →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <Carousel className="w-full">
            <CarouselContent>
              {posts.map((post) => (
                <CarouselItem key={post.id}>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                    <div className="relative h-64 bg-slate-900">{renderMedia(post)}</div>
                    <div className="p-6">
                      {post.category && (
                        <div className="text-xs uppercase tracking-wide text-blue-400 mb-2">{post.category}</div>
                      )}
                      <h3 className="text-xl font-bold text-white mb-4">{post.title}</h3>
                      <ScrollArea className="h-32">
                        <p className="text-base text-slate-300 leading-relaxed pr-4">{post.excerpt}</p>
                      </ScrollArea>
                      <Link to={`/blog/${post.slug}`} className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm font-medium">
                        Read more →
                      </Link>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        </div>
      </div>
    </section>
  );
};
