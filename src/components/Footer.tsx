
import React from 'react';

export const Footer = () => {
  return (
    <footer className="bg-slate-800 border-t border-slate-700 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-center md:text-left text-slate-400">
            <p>&copy; 2025 Hero TV Mounting. All rights reserved.</p>
          </div>
          <div className="flex space-x-6">
            <a 
              href="/worker-signup" 
              className="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium"
            >
              Join Our Team
            </a>
            <a 
              href="tel:+17372729971" 
              className="text-slate-400 hover:text-slate-300 transition-colors duration-200"
            >
              Contact Us
            </a>
          </div>
        </div>
        
        {/* Developer Credit */}
        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-sm text-slate-500">
            Developed by{' '}
            <a 
              href="https://www.charusolutions.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="transition-all duration-300 inline-block hover:scale-110 hover:transform-gpu"
            >
              <span 
                style={{ color: '#4285F4' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                Cha
              </span>
              <span 
                style={{ color: '#EA4335' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                ru
              </span>
              <span className="text-slate-500"> </span>
              <span 
                style={{ color: '#FBBC05' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                Sol
              </span>
              <span 
                style={{ color: '#34A853' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                uti
              </span>
              <span 
                style={{ color: '#4285F4' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                ons
              </span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
