
import React from 'react';
import { Star } from 'lucide-react';

export const ReviewsSection = () => {
  const reviews = [
    {
      id: 1,
      quote: "Amazing service! They mounted our 75\" TV perfectly and hid all the cables. The technician was professional and cleaned up after himself. Highly recommend!",
      rating: 5,
      name: "Sarah M.",
      city: "Austin, TX",
      image: "/lovable-uploads/4f2b0612-e53a-4743-9241-89f3d0c96f3f.png",
      imageLeft: true
    },
    {
      id: 2,
      quote: "Hero TV Mounting saved my living room! What used to be a mess of cables is now a clean, modern entertainment space. The full motion mount is perfect for our sectional.",
      rating: 5,
      name: "Mike R.",
      city: "Dallas, TX",
      image: "/lovable-uploads/9b5c911a-cfc6-4311-94bb-902ce479c279.png",
      imageLeft: false
    },
    {
      id: 3,
      quote: "Professional installation and fair pricing. They even moved our outlet behind the TV so there are zero visible wires. The attention to detail was impressive.",
      rating: 5,
      name: "Jennifer L.",
      city: "Houston, TX",
      image: "/lovable-uploads/1cdefbf0-13c5-4f66-bb5c-761861d66f74.png",
      imageLeft: true
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            What Our Customers Say
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Real reviews from satisfied customers across Texas
          </p>
        </div>
        
        <div className="space-y-16">
          {reviews.map((review) => (
            <div 
              key={review.id} 
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-center`}
            >
              <div className={`${review.imageLeft ? 'lg:order-1' : 'lg:order-2'}`}>
                <div className="relative rounded-xl overflow-hidden">
                  <img 
                    src={review.image} 
                    alt={`Customer ${review.name} installation`}
                    className="w-full h-64 lg:h-80 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                </div>
              </div>
              
              <div className={`${review.imageLeft ? 'lg:order-2' : 'lg:order-1'}`}>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-8 border border-slate-700">
                  <div className="flex items-center mb-4">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  
                  <blockquote className="text-lg text-white mb-6 leading-relaxed">
                    "{review.quote}"
                  </blockquote>
                  
                  <div className="text-slate-300">
                    <div className="font-semibold">{review.name}</div>
                    <div className="text-sm">{review.city}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
