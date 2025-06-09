
import React from 'react';
import { Phone } from 'lucide-react';

export const Header = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/1e76b3b7-06d3-4e94-8f33-7f5b04c2a5e4.png" 
              alt="Hero TV Mounting" 
              className="h-8 w-8"
            />
            <h1 className="text-xl font-bold text-gray-900">
              Hero TV Mounting
            </h1>
          </div>
          
          <a 
            href="tel:+17372729971"
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span className="font-medium">+1 737-272-9971</span>
          </a>
        </div>
      </div>
    </header>
  );
};
