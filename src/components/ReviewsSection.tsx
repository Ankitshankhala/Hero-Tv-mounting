
import React from 'react';
import { Star } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useReviewsData } from '@/hooks/useReviewsData';

export const ReviewsSection = () => {
  const { reviews } = useReviewsData();

  // Reserve minimum space even before reviews load to prevent layout shift
  const reviewsToShow = reviews.length > 0 ? reviews : [null, null, null]; // Show placeholders

  return (
    <section className="py-16 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Reviews
          </h2>
        </div>
        
        {/* Desktop: Vertical scroll of cards */}
        <div className="hidden md:block">
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-6 pr-4">
              {reviewsToShow.map((review, index) => (
                <div 
                  key={review?.id || `placeholder-${index}`} 
                  className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700"
                >
                  <div className="grid grid-cols-2 h-80">
                    {/* Image Section */}
                    <div className="relative">
                      {review ? (
                        <img 
                          src={review.image} 
                          alt={`Customer ${review.name} installation`}
                          className="w-full h-full object-cover"
                          width="400"
                          height="320"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-700 animate-pulse" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    </div>
                    
                    {/* Text Section */}
                    <div className="p-8 flex flex-col justify-center">
                      {review ? (
                        <>
                          <div className="flex items-center mb-4">
                            {[...Array(review.rating)].map((_, i) => (
                              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                          
                          <ScrollArea className="flex-1 mb-6">
                            <blockquote className="text-lg text-white leading-relaxed pr-4">
                              "{review.quote}"
                            </blockquote>
                          </ScrollArea>
                          
                          <div className="text-slate-300">
                            <div className="font-semibold text-white text-lg">{review.name}</div>
                            <div className="text-sm text-slate-400">{review.city}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center mb-4">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-5 w-5 bg-slate-600 rounded animate-pulse mr-1" />
                            ))}
                          </div>
                          
                          <div className="flex-1 mb-6">
                            <div className="space-y-2">
                              <div className="h-4 bg-slate-600 rounded animate-pulse" />
                              <div className="h-4 bg-slate-600 rounded animate-pulse w-3/4" />
                              <div className="h-4 bg-slate-600 rounded animate-pulse w-1/2" />
                            </div>
                          </div>
                          
                          <div className="text-slate-300">
                            <div className="h-6 bg-slate-600 rounded animate-pulse mb-2" />
                            <div className="h-4 bg-slate-600 rounded animate-pulse w-1/3" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Mobile: Touch slider */}
        <div className="md:hidden">
          <Carousel className="w-full">
            <CarouselContent>
              {reviewsToShow.map((review, index) => (
                <CarouselItem key={review?.id || `mobile-placeholder-${index}`}>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                    {/* Mobile: Stack image on top, text below */}
                    <div className="relative h-64">
                      {review ? (
                        <img 
                          src={review.image} 
                          alt={`Customer ${review.name} installation`}
                          className="w-full h-full object-cover"
                          width="375"
                          height="256"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-700 animate-pulse" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    </div>
                    
                    <div className="p-6">
                      {review ? (
                        <>
                          <div className="flex items-center mb-4">
                            {[...Array(review.rating)].map((_, i) => (
                              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                          
                          <ScrollArea className="h-32 mb-6">
                            <blockquote className="text-base text-white leading-relaxed pr-4">
                              "{review.quote}"
                            </blockquote>
                          </ScrollArea>
                          
                          <div className="text-slate-300">
                            <div className="font-semibold text-white text-lg">{review.name}</div>
                            <div className="text-sm text-slate-400">{review.city}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center mb-4">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-5 w-5 bg-slate-600 rounded animate-pulse mr-1" />
                            ))}
                          </div>
                          
                          <div className="h-32 mb-6">
                            <div className="space-y-2">
                              <div className="h-4 bg-slate-600 rounded animate-pulse" />
                              <div className="h-4 bg-slate-600 rounded animate-pulse w-3/4" />
                              <div className="h-4 bg-slate-600 rounded animate-pulse w-1/2" />
                            </div>
                          </div>
                          
                          <div className="text-slate-300">
                            <div className="h-6 bg-slate-600 rounded animate-pulse mb-2" />
                            <div className="h-4 bg-slate-600 rounded animate-pulse w-1/3" />
                          </div>
                        </>
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
