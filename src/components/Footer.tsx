
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
        
        {/* Developer Credit */}
        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-sm text-slate-500">
            Developed by{' '}
            <a 
              href="https://www.charusolutions.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity duration-200"
            >
              <span style={{ color: '#4285F4' }}>C</span>
              <span style={{ color: '#EA4335' }}>h</span>
              <span style={{ color: '#FBBC05' }}>a</span>
              <span style={{ color: '#34A853' }}>r</span>
              <span style={{ color: '#4285F4' }}>u</span>
              <span className="text-slate-400"> </span>
              <span style={{ color: '#EA4335' }}>S</span>
              <span style={{ color: '#FBBC05' }}>o</span>
              <span style={{ color: '#34A853' }}>l</span>
              <span style={{ color: '#4285F4' }}>u</span>
              <span style={{ color: '#EA4335' }}>t</span>
              <span style={{ color: '#FBBC05' }}>i</span>
              <span style={{ color: '#34A853' }}>o</span>
              <span style={{ color: '#4285F4' }}>n</span>
              <span style={{ color: '#EA4335' }}>s</span>
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
