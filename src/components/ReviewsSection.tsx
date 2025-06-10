
import React from 'react';
import { Star } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export const ReviewsSection = () => {
  const reviews = [
    {
      id: 1,
      quote: "Amazing service! They mounted our 75\" TV perfectly and hid all the cables. The technician was professional and cleaned up after himself. Highly recommend!",
      rating: 5,
      name: "Sarah M.",
      city: "Austin, TX",
      image: "/lovable-uploads/4f2b0612-e53a-4743-9241-89f3d0c96f3f.png"
    },
    {
      id: 2,
      quote: "Hero TV Mounting saved my living room! What used to be a mess of cables is now a clean, modern entertainment space. The full motion mount is perfect for our sectional.",
      rating: 5,
      name: "Mike R.",
      city: "Dallas, TX",
      image: "/lovable-uploads/9b5c911a-cfc6-4311-94bb-902ce479c279.png"
    },
    {
      id: 3,
      quote: "Professional installation and fair pricing. They even moved our outlet behind the TV so there are zero visible wires. The attention to detail was impressive.",
      rating: 5,
      name: "Jennifer L.",
      city: "Houston, TX",
      image: "/lovable-uploads/1cdefbf0-13c5-4f66-bb5c-761861d66f74.png"
    },
    {
      id: 4,
      quote: "The team arrived on time and completed the installation quickly. Our 65\" TV looks amazing on the wall and the cable management is flawless. Will definitely use them again!",
      rating: 5,
      name: "David K.",
      city: "San Antonio, TX",
      image: "/lovable-uploads/4f2b0612-e53a-4743-9241-89f3d0c96f3f.png"
    },
    {
      id: 5,
      quote: "Excellent customer service from start to finish. They explained everything clearly and the final result exceeded our expectations. The TV mounting looks professional and secure.",
      rating: 5,
      name: "Lisa P.",
      city: "Fort Worth, TX",
      image: "/lovable-uploads/9b5c911a-cfc6-4311-94bb-902ce479c279.png"
    }
  ];

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
              {reviews.map((review) => (
                <div 
                  key={review.id} 
                  className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700"
                >
                  <div className="grid grid-cols-2 h-80">
                    {/* Image Section */}
                    <div className="relative">
                      <img 
                        src={review.image} 
                        alt={`Customer ${review.name} installation`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    </div>
                    
                    {/* Text Section */}
                    <div className="p-8 flex flex-col justify-center">
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
                        <div className="font-semibold">{review.name}</div>
                        <div className="text-sm">{review.city}</div>
                      </div>
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
              {reviews.map((review) => (
                <CarouselItem key={review.id}>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                    {/* Mobile: Stack image on top, text below */}
                    <div className="relative h-64">
                      <img 
                        src={review.image} 
                        alt={`Customer ${review.name} installation`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    </div>
                    
                    <div className="p-6">
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
                        <div className="font-semibold">{review.name}</div>
                        <div className="text-sm">{review.city}</div>
                      </div>
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
