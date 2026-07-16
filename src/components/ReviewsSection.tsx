import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
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

  if (!loading && reviews.length === 0) return null;

  const reviewsToShow: (DbReview | null)[] = reviews.length > 0 ? reviews : [null, null, null];

  return (
    <section className="py-16 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Reviews</h2>
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-6 pr-4">
              {reviewsToShow.map((review, index) => (
                <div
                  key={review?.id || `placeholder-${index}`}
                  className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700"
                >
                  <div className="grid grid-cols-2 h-80">
                    <div className="relative aspect-[5/4] overflow-hidden">
                      {review ? (
                        <img
                          src={review.image_url || FALLBACK_IMAGE}
                          alt={`Customer ${review.customer_name} installation`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-700 animate-pulse" />
                      )}
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                      {review ? (
                        <>
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
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div className="h-5 bg-slate-600 rounded animate-pulse w-32" />
                          <div className="h-4 bg-slate-600 rounded animate-pulse" />
                          <div className="h-4 bg-slate-600 rounded animate-pulse w-3/4" />
                          <div className="h-4 bg-slate-600 rounded animate-pulse w-1/2" />
                        </div>
                      )}
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
              {reviewsToShow.map((review, index) => (
                <CarouselItem key={review?.id || `mobile-placeholder-${index}`}>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                    <div className="relative h-64 aspect-[3/2] overflow-hidden">
                      {review ? (
                        <img
                          src={review.image_url || FALLBACK_IMAGE}
                          alt={`Customer ${review.customer_name} installation`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-700 animate-pulse" />
                      )}
                    </div>
                    <div className="p-6">
                      {review ? (
                        <>
                          <div className="flex items-center mb-4">
                            {[...Array(review.rating)].map((_, i) => (
                              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                          {review.title && (
                            <div className="text-white font-semibold mb-2">{review.title}</div>
                          )}
                          <blockquote className="text-base text-white leading-relaxed mb-6">
                            "{review.comment}"
                          </blockquote>
                          <div className="text-slate-300">
                            <div className="font-semibold text-white text-lg">{review.customer_name}</div>
                            {review.city && <div className="text-sm text-slate-400">{review.city}</div>}
                          </div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div className="h-5 bg-slate-600 rounded animate-pulse w-32" />
                          <div className="h-4 bg-slate-600 rounded animate-pulse" />
                          <div className="h-4 bg-slate-600 rounded animate-pulse w-3/4" />
                        </div>
                      )}
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
