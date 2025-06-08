
import React from 'react';
import { Star, Clock, MapPin } from 'lucide-react';

export const StoreHeader = () => {
  return (
    <div className="bg-slate-900 border-b border-slate-700">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-32 h-32 rounded-lg overflow-hidden">
            <img 
              src="/lovable-uploads/4f2b0612-e53a-4743-9241-89f3d0c96f3f.png" 
              alt="Hero TV Mounting"
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">Hero TV Mounting</h1>
            <p className="text-slate-300 mb-4">Professional TV mounting and cable management services</p>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-white">4.9</span>
                <span>(500+)</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Same day • 30-60 min</span>
              </div>
              
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>Delivery fee $0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
