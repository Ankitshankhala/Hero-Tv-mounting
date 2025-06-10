
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const Header = () => {
  return (
    <header className="relative bg-gradient-to-r from-slate-900 to-slate-800 text-white">
      <div className="relative container mx-auto px-4 py-12">
        <div className="absolute top-4 right-4">
          <Link 
            to="/admin"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 text-sm font-medium"
          >
            <Shield className="h-4 w-4" />
            <span>Admin</span>
          </Link>
        </div>
        
        <div className="flex items-center justify-center mb-8">
          <img 
            src="/lovable-uploads/012bbdab-1222-48ae-aa4b-d7bb3c3aa632.png" 
            alt="Hero TV Mounting Logo" 
            className="h-12 w-12 mr-4"
          />
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Hero TV Mounting
          </h1>
        </div>
        
        <div className="text-center">
          <a 
            href="tel:+17372729971"
            className="text-2xl md:text-3xl text-blue-400 hover:text-blue-300 transition-colors duration-200 font-semibold"
          >
            +1 737-272-9971
          </a>
        </div>
      </div>
    </header>
  );
};
