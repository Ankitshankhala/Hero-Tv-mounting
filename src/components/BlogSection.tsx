
import React from 'react';
import { Play } from 'lucide-react';

export const BlogSection = () => {
  const blogPosts = [
    {
      id: 1,
      title: "TV Height and Position",
      content: "Learn the optimal height and viewing angles for your TV installation. Proper positioning ensures comfortable viewing and reduces neck strain.",
      videoId: "dQw4w9WgXcQ", // Placeholder YouTube video ID
      imageLeft: true
    },
    {
      id: 2,
      title: "About Our Mounts",
      content: "Discover the different types of TV mounts we use and why quality hardware makes all the difference for safety and durability.",
      videoId: "dQw4w9WgXcQ", // Placeholder YouTube video ID
      imageLeft: false
    },
    {
      id: 3,
      title: "Crush the Wires",
      content: "See how we completely hide cables for a clean, professional look that transforms your living space into a modern entertainment center.",
      videoId: "dQw4w9WgXcQ", // Placeholder YouTube video ID
      imageLeft: true
    }
  ];

  return (
    <section className="py-16 bg-slate-900/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Learn More
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Expert tips and insights from our professional installers
          </p>
        </div>
        
        <div className="space-y-16">
          {blogPosts.map((post) => (
            <div 
              key={post.id} 
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-center ${
                post.imageLeft ? '' : 'lg:grid-cols-2'
              }`}
            >
              <div className={`${post.imageLeft ? 'lg:order-1' : 'lg:order-2'}`}>
                <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 group-hover:scale-110 transition-transform duration-300">
                      <Play className="h-12 w-12 text-white fill-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-white text-sm opacity-75">Watch Video</div>
                  </div>
                </div>
              </div>
              
              <div className={`${post.imageLeft ? 'lg:order-2' : 'lg:order-1'}`}>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  {post.title}
                </h3>
                <p className="text-lg text-slate-300 leading-relaxed">
                  {post.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
