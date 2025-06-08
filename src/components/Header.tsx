
import React from 'react';
import { Monitor, Star } from 'lucide-react';

export const Header = () => {
  return (
    <header className="relative bg-gradient-to-r from-slate-900 to-slate-800 text-white">
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }} />
      </div>
      
      <div className="relative container mx-auto px-4 py-12">
        <div className="flex items-center justify-center mb-8">
          <Monitor className="h-12 w-12 text-blue-400 mr-4" />
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Hero TV Mounting
          </h1>
        </div>
        
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xl md:text-2xl text-slate-300 mb-6">
            Professional TV mounting and cable management services
          </p>
          <div className="flex items-center justify-center space-x-2 mb-8">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            ))}
            <span className="text-slate-300 ml-2">4.9/5 from 500+ customers</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
              <div className="text-2xl font-bold text-blue-400 mb-2">Same Day</div>
              <div className="text-slate-300">Installation Available</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
              <div className="text-2xl font-bold text-blue-400 mb-2">Licensed</div>
              <div className="text-slate-300">& Insured Professionals</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
              <div className="text-2xl font-bold text-blue-400 mb-2">Lifetime</div>
              <div className="text-slate-300">Workmanship Guarantee</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
