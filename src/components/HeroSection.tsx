
import React from 'react';

interface HeroSectionProps {
  onOpenModal: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenModal }) => {
  return (
    <section className="py-16 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          Professional TV Mounting
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Same day installation available. Licensed & insured professionals with lifetime workmanship guarantee.
        </p>
        
        <button
          onClick={onOpenModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold px-12 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          TV Mounting
        </button>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-blue-600 mb-2">Same Day</div>
            <div className="text-gray-600">Installation Available</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-blue-600 mb-2">Licensed</div>
            <div className="text-gray-600">& Insured Professionals</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-blue-600 mb-2">Lifetime</div>
            <div className="text-gray-600">Workmanship Guarantee</div>
          </div>
        </div>
      </div>
    </section>
  );
};
