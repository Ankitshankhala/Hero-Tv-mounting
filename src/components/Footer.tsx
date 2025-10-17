
import React from 'react';
import { Facebook, Instagram, Linkedin } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-slate-800 border-t border-slate-700 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start space-y-6 md:space-y-0">
          <div className="text-center md:text-left text-slate-400">
            <p>&copy; 2025 Hero TV Mounting. All rights reserved.</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-8">
            <div className="text-center md:text-left">
              <div className="text-slate-300 font-semibold mb-2">Service Areas</div>
              <ul className="space-y-1 text-slate-400 text-sm">
                <li><a href="/locations/austin" className="hover:text-slate-200 transition-colors duration-200">Austin, TX</a></li>
                <li><a href="/locations/san-antonio" className="hover:text-slate-200 transition-colors duration-200">San Antonio, TX</a></li>
                <li><a href="/locations/fort-worth" className="hover:text-slate-200 transition-colors duration-200">Fort Worth, TX</a></li>
                <li><a href="/locations/dallas" className="hover:text-slate-200 transition-colors duration-200">Dallas, TX</a></li>
                <li><a href="/locations/houston" className="hover:text-slate-200 transition-colors duration-200">Houston, TX</a></li>
              </ul>
            </div>
            
            <div className="flex flex-col space-y-2 text-center md:text-left">
              <a 
                href="/worker-signup" 
                className="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium"
              >
                Join Our Team
              </a>
              <a 
                href="/worker-login" 
                className="text-slate-400 hover:text-slate-300 transition-colors duration-200"
              >
                Technician Portal
              </a>
              <a 
                href="tel:+15752088997" 
                className="text-slate-400 hover:text-slate-300 transition-colors duration-200"
              >
                Contact Us
              </a>
            </div>
            
            <div className="flex flex-col space-y-3 text-center md:text-left">
              <div className="text-slate-300 font-semibold mb-1">Follow Us</div>
              <div className="flex gap-4 justify-center md:justify-start">
                <a 
                  href="https://facebook.com/herotvmounting" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="Visit our Facebook page"
                  className="text-slate-400 hover:text-blue-500 transition-colors duration-200"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a 
                  href="https://instagram.com/herotvmounting" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="Visit our Instagram page"
                  className="text-slate-400 hover:text-pink-500 transition-colors duration-200"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a 
                  href="https://linkedin.com/company/herotvmounting" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="Visit our LinkedIn page"
                  className="text-slate-400 hover:text-blue-400 transition-colors duration-200"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
        
        {/* Developer Credit */}
        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-sm text-slate-300">
            Developed by{' '}
            <a 
              href="https://www.charusolutions.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="transition-all duration-300 inline-block hover:scale-110 hover:transform-gpu"
            >
              <span 
                style={{ color: '#5B9BF5' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                Cha
              </span>
              <span 
                style={{ color: '#F56565' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                ru
              </span>
              <span className="text-slate-300"> </span>
              <span 
                style={{ color: '#FBBC05' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                Sol
              </span>
              <span 
                style={{ color: '#48BB78' }}
                className="hover:brightness-125 transition-all duration-200"
              >
                uti
              </span>
              <span 
                style={{ color: '#5B9BF5' }}
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
