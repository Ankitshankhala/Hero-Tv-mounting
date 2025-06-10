
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export const BlogSection = () => {
  const proTips = [
    {
      id: 1,
      title: "Optimal TV Height and Viewing Angles",
      content: "Proper TV mounting height is crucial for comfortable viewing and neck health. The center of your TV screen should be at eye level when seated. For most living rooms, this means mounting the TV 42-48 inches from the floor to the center of the screen. Consider the viewing distance - your TV should be 1.5 to 2.5 times the screen size away from your seating. Tilt brackets can help achieve the perfect viewing angle, especially for TVs mounted higher than ideal. Professional TV mounting ensures optimal positioning for your specific room layout and furniture arrangement.",
      videoId: "dQw4w9WgXcQ"
    },
    {
      id: 2,
      title: "TV Mount Types and Wall Compatibility",
      content: "Choosing the right TV mount depends on your wall type and viewing needs. Fixed mounts provide the most stability and are perfect for drywall installations. Full-motion mounts offer maximum flexibility, allowing you to tilt, swivel, and extend your TV for optimal viewing from different angles. Tilting mounts are ideal for TVs mounted above eye level. Wall compatibility is essential - drywall requires proper stud mounting, while brick, stone, and tile walls need specialized anchors and drilling techniques. Professional installers assess your wall type and recommend the best mounting solution for safety and longevity.",
      videoId: "dQw4w9WgXcQ"
    },
    {
      id: 3,
      title: "Cable Management and Wire Concealment",
      content: "Clean cable management transforms your entertainment space from cluttered to professional. In-wall cable concealment provides the cleanest look by running cables through the wall cavity between studs. Surface-mount cable covers offer a quick solution for rentals or when in-wall isn't possible. Proper cable routing prevents signal interference and maintains optimal performance for your devices. Professional installers can relocate power outlets behind your TV for a completely wireless appearance. Fire-rated cable management ensures safety compliance while maintaining that sleek, modern aesthetic you want in your living space.",
      videoId: "dQw4w9WgXcQ"
    }
  ];

  return (
    <section className="py-16 bg-slate-900/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pro Tips
          </h2>
        </div>
        
        {/* Desktop: Vertical scroll of cards */}
        <div className="hidden md:block">
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-6 pr-4">
              {proTips.map((tip) => (
                <div key={tip.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                  <div className="grid grid-cols-2 h-80">
                    {/* Video Card */}
                    <div className="relative bg-slate-900">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-8 hover:scale-110 transition-transform duration-300 cursor-pointer">
                          <svg 
                            className="h-16 w-16 text-white fill-white" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="absolute bottom-6 left-6 right-6">
                        <div className="text-white text-sm opacity-75">Watch Expert Tips</div>
                      </div>
                    </div>
                    
                    {/* Text Card */}
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      <h3 className="text-xl md:text-2xl font-bold text-white mb-4 line-clamp-2">
                        {tip.title}
                      </h3>
                      <ScrollArea className="flex-1">
                        <p className="text-sm md:text-base text-slate-300 leading-relaxed pr-4">
                          {tip.content}
                        </p>
                      </ScrollArea>
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
              {proTips.map((tip) => (
                <CarouselItem key={tip.id}>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                    {/* Mobile: Stack video on top, text below */}
                    <div className="relative h-64 bg-slate-900">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-8 hover:scale-110 transition-transform duration-300 cursor-pointer">
                          <svg 
                            className="h-16 w-16 text-white fill-white" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7"/>
                          </svg>
                        </div>
                      </div>
                      <div className="absolute bottom-6 left-6 right-6">
                        <div className="text-white text-sm opacity-75">Watch Expert Tips</div>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-white mb-4">
                        {tip.title}
                      </h3>
                      
                      <ScrollArea className="h-32">
                        <p className="text-base text-slate-300 leading-relaxed pr-4">
                          {tip.content}
                        </p>
                      </ScrollArea>
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
