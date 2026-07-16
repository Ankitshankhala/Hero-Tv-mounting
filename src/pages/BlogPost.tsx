import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import SEO from '@/components/SEO';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface Post {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  author: string | null;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  video_id: string | null;
  publish_date: string | null;
  created_at: string;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetch = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .or(`publish_date.is.null,publish_date.lte.${today}`)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setPost(data as Post);
      }
      setLoading(false);
    };
    fetch();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold mb-4">Post not found</h1>
          <Link to="/blog" className="text-blue-400 hover:text-blue-300">← Back to blog</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const publishDateStr = post.publish_date || post.created_at;
  const displayDate = publishDateStr ? new Date(publishDateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <SEO
        title={`${post.title} | Hero TV Mounting`}
        description={post.excerpt || undefined}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          author: post.author ? { '@type': 'Person', name: post.author } : undefined,
          datePublished: publishDateStr,
          image: post.cover_image_url || undefined,
        }}
      />
      <Header />
      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <Link to="/blog" className="text-blue-400 hover:text-blue-300 text-sm">← Back to blog</Link>
        <div className="mt-4 mb-6">
          {post.category && (
            <div className="text-xs uppercase tracking-wide text-blue-400 mb-2">{post.category}</div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{post.title}</h1>
          <div className="text-sm text-slate-400">
            {post.author ? `By ${post.author}` : ''}{post.author && displayDate ? ' · ' : ''}{displayDate}
          </div>
        </div>

        {post.video_id ? (
          <div className="aspect-video mb-8 rounded-xl overflow-hidden bg-black">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${post.video_id}`}
              title={post.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : post.cover_image_url ? (
          <img src={post.cover_image_url} alt={post.title} className="w-full rounded-xl mb-8" />
        ) : null}

        {post.excerpt && (
          <p className="text-lg text-slate-300 mb-6 italic">{post.excerpt}</p>
        )}
        <div className="prose prose-invert max-w-none text-slate-200 whitespace-pre-wrap leading-relaxed">
          {post.content}
        </div>
      </article>
      <Footer />
    </div>
  );
};

export default BlogPost;
