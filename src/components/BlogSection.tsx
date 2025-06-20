
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useBlogData } from '@/hooks/useBlogData';

export const BlogSection = () => {
  const { blogPosts } = useBlogData();

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
              {blogPosts.map((tip) => (
                <div key={tip.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                  <div className="grid grid-cols-2 h-80">
                    {/* Video Card */}
                    <div className="relative bg-slate-900">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {tip.hasVideo ? (
                          <div className="bg-white/20 backdrop-blur-sm rounded-full p-8 hover:scale-110 transition-transform duration-300 cursor-pointer">
                            <svg 
                              className="h-16 w-16 text-white fill-white" 
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        ) : (
                          <div className="text-white/60 text-center">
                            <div className="text-2xl font-bold mb-2">{tip.category}</div>
                            <div className="text-sm">Text Content</div>
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-6 left-6 right-6">
                        <div className="text-white text-sm opacity-75">
                          {tip.hasVideo ? 'Watch Expert Tips' : 'Read More'}
                        </div>
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
              {blogPosts.map((tip) => (
                <CarouselItem key={tip.id}>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700">
                    {/* Mobile: Stack video on top, text below */}
                    <div className="relative h-64 bg-slate-900">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {tip.hasVideo ? (
                          <div className="bg-white/20 backdrop-blur-sm rounded-full p-8 hover:scale-110 transition-transform duration-300 cursor-pointer">
                            <svg 
                              className="h-16 w-16 text-white fill-white" 
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7"/>
                            </svg>
                          </div>
                        ) : (
                          <div className="text-white/60 text-center">
                            <div className="text-2xl font-bold mb-2">{tip.category}</div>
                            <div className="text-sm">Text Content</div>
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-6 left-6 right-6">
                        <div className="text-white text-sm opacity-75">
                          {tip.hasVideo ? 'Watch Expert Tips' : 'Read More'}
                        </div>
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
