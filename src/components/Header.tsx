
import React from 'react';
import { Button } from '@/components/ui/button';

const Header = () => {
  return (
    <header className="bg-slate-900 text-white py-3">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl">★</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Hero TV Mounting
            </h1>
          </div>
          <div className="text-blue-400 font-semibold">
            +1 737-272-9971
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Worker Login
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Admin
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
