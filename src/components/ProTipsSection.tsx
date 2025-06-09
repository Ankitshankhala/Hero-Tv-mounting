
import React from 'react';
import { Play } from 'lucide-react';

export const ProTipsSection = () => {
  const proTips = [
    {
      id: 1,
      title: "Perfect TV Height and Viewing Angles",
      content: "Learn the optimal height and viewing angles for your TV installation. Proper positioning ensures comfortable viewing and reduces neck strain. The center of your screen should be at eye level when seated. For most living rooms, this means the center of the TV should be 42-48 inches from the floor. Consider the height of your furniture and typical viewing positions.",
      videoId: "dQw4w9WgXcQ",
      keywords: "TV height, viewing angle, ergonomic mounting, eye level, comfortable viewing"
    },
    {
      id: 2,
      title: "Premium Mounting Hardware Selection",
      content: "Discover the different types of TV mounts we use and why quality hardware makes all the difference for safety and durability. From fixed mounts for a clean look to full-motion mounts for flexibility, choosing the right mount depends on your viewing needs, wall type, and TV size. We only use commercial-grade hardware rated for twice your TV's weight.",
      videoId: "dQw4w9WgXcQ",
      keywords: "TV mounts, mounting hardware, wall mounts, full motion mounts, safety"
    },
    {
      id: 3,
      title: "Professional Cable Management Solutions",
      content: "See how we completely hide cables for a clean, professional look that transforms your living space. Our cable management solutions include in-wall routing, decorative covers, and fire-safe concealment systems. We ensure all electrical work meets local codes while maintaining the aesthetic appeal of your room.",
      videoId: "dQw4w9WgXcQ",
      keywords: "cable management, wire concealment, in-wall routing, clean installation"
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Pro Tips for TV Mounting
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Expert insights and professional tips from our installation specialists
          </p>
        </div>
        
        <div className="space-y-12">
          {proTips.map((tip) => (
            <div key={tip.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="relative bg-gray-900 aspect-video group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 group-hover:scale-110 transition-transform duration-300">
                      <Play className="h-12 w-12 text-white fill-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-white text-sm opacity-75">Watch Pro Tip Video</div>
                  </div>
                </div>
                
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {tip.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    {tip.content}
                  </p>
                  <div className="text-xs text-gray-500 italic">
                    Keywords: {tip.keywords}
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
