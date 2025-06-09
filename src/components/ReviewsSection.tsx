
import React from 'react';
import { Star } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export const ReviewsSection = () => {
  const reviews = [
    {
      id: 1,
      quote: "Amazing service! They mounted our 75\" TV perfectly and hid all the cables. The technician was professional and cleaned up after himself. Highly recommend for anyone looking for quality work!",
      rating: 5,
      name: "Sarah M.",
      city: "Austin, TX",
      image: "/lovable-uploads/4f2b0612-e53a-4743-9241-89f3d0c96f3f.png"
    },
    {
      id: 2,
      quote: "Hero TV Mounting saved my living room! What used to be a mess of cables is now a clean, modern entertainment space. The full motion mount is perfect for our sectional couch.",
      rating: 5,
      name: "Mike R.",
      city: "Dallas, TX",
      image: "/lovable-uploads/9b5c911a-cfc6-4311-94bb-902ce479c279.png"
    },
    {
      id: 3,
      quote: "Professional installation and fair pricing. They even moved our outlet behind the TV so there are zero visible wires. The attention to detail was impressive and exceeded our expectations.",
      rating: 5,
      name: "Jennifer L.",
      city: "Houston, TX",
      image: "/lovable-uploads/1cdefbf0-13c5-4f66-bb5c-761861d66f74.png"
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Customers Say
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Real reviews from satisfied customers across Texas
          </p>
        </div>
        
        <Carousel className="w-full max-w-5xl mx-auto">
          <CarouselContent>
            {reviews.map((review) => (
              <CarouselItem key={review.id} className="md:basis-1/2 lg:basis-1/3">
                <div className="bg-gray-50 rounded-xl overflow-hidden shadow-md h-full">
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={review.image} 
                      alt={`Customer ${review.name} installation`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center mb-3">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    
                    <div className="h-32 overflow-y-auto mb-4">
                      <blockquote className="text-gray-700 leading-relaxed">
                        "{review.quote}"
                      </blockquote>
                    </div>
                    
                    <div className="text-gray-600">
                      <div className="font-semibold">{review.name}</div>
                      <div className="text-sm">{review.city}</div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </section>
  );
};
