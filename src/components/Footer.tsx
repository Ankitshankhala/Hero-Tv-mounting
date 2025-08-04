
import React from 'react';

export const Footer = () => {
  return (
    <footer className="bg-slate-800 border-t border-slate-700 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-center md:text-left text-slate-400">
            <p>&copy; 2025 TV Mounting Services. All rights reserved.</p>
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
      </div>
    </footer>
  );
};
