import React, { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface DbReview {
  id: string;
  customer_name: string;
  city: string | null;
  rating: number;
  title: string | null;
  comment: string;
  image_url: string | null;
  is_featured: boolean;
  created_at: string;
}

const FALLBACK_IMAGE = '/assets/images/reviews/default-customer.png';

export const ReviewsSection = () => {
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id, customer_name, city, rating, title, comment, image_url, is_featured, created_at')
        .eq('status', 'approved')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (!mounted) return;
      setReviews((data as DbReview[]) || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { avg, count } = useMemo(() => {
    if (reviews.length === 0) return { avg: 5.0, count: 0 };
    const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
    return { avg: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  if (!loading && reviews.length === 0) return null;

  return (
    <section className="py-10 md:py-16 bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="mb-6 md:mb-10 md:text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">Reviews</h2>
          {count > 0 && (
            <div className="flex items-center gap-2 text-slate-300 text-sm md:justify-center">
              <span className="inline-flex items-center gap-1 font-semibold text-white">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {avg.toFixed(1)}
              </span>
              <span className="text-slate-400">· {count} review{count === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>

        {/* Mobile: horizontal snap carousel */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="snap-start shrink-0 w-[85%] bg-slate-800/60 border border-slate-700 rounded-xl p-4"
              >
                <div className="flex items-center mb-2">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-200 leading-snug line-clamp-3 mb-3">
                  "{review.comment}"
                </p>
                <div className="text-xs text-slate-400">
                  <span className="font-medium text-white">{review.customer_name}</span>
                  {review.city && <span> · {review.city}</span>}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Desktop: original tall layout preserved */}
        <div className="hidden md:block">
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-6 pr-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700"
                >
                  <div className="grid grid-cols-2 h-80">
                    <div className="relative aspect-[5/4] overflow-hidden">
                      <img
                        src={review.image_url || FALLBACK_IMAGE}
                        alt={`Customer ${review.customer_name} installation`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        width="500"
                        height="400"
                      />
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                      <div className="flex items-center mb-4">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      {review.title && (
                        <div className="text-white font-semibold text-lg mb-2">{review.title}</div>
                      )}
                      <blockquote className="text-lg text-white leading-relaxed flex-1 mb-6">
                        "{review.comment}"
                      </blockquote>
                      <div className="text-slate-300">
                        <div className="font-semibold text-white text-lg">{review.customer_name}</div>
                        {review.city && <div className="text-sm text-slate-400">{review.city}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </section>
  );
};
