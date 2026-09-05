
import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Phone, Mail } from 'lucide-react';
import { getAllCities } from '@/data/cities';

const cities = getAllCities().map((c) => ({ name: c.fullName, href: c.path }));

const linkCls =
  'inline-flex items-center min-h-[44px] text-sm text-slate-400 hover:text-blue-400 transition-colors';

export const Footer = () => {
  return (
    <footer className="bg-slate-800 border-t border-slate-700">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
        {/* Mobile: stacked (unchanged). Desktop: 12-col grid */}
        <div className="md:grid md:grid-cols-12 md:gap-8">
          {/* Brand block */}
          <div className="md:col-span-5 max-w-sm">
            <div className="flex items-center gap-3">
              <img
                src="/assets/images/logo.png"
                alt="Hero TV Mounting"
                width={40}
                height={40}
                className="h-10 w-10 rounded"
                loading="lazy"
              />
              <div className="text-white font-semibold text-base">Hero TV Mounting</div>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Professional TV mounting across Texas, Florida & Georgia
            </p>
            <div className="mt-3 flex flex-col gap-1">
              <a
                href="tel:+17372729971"
                className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Phone className="h-4 w-4" />
                737-272-9971
              </a>
              <a
                href="mailto:support@herotvmounting.com"
                className="inline-flex items-center gap-2 min-h-[44px] text-sm text-slate-300 hover:text-blue-400 transition-colors"
              >
                <Mail className="h-4 w-4" />
                Contact us
              </a>
            </div>

            {/* Social */}
            <div className="mt-3 flex gap-3">
              <a
                href="https://facebook.com/herotvmounting"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex items-center justify-center w-11 h-11 rounded-md text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com/herotvmounting"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex items-center justify-center w-11 h-11 rounded-md text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com/company/herotvmounting"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="inline-flex items-center justify-center w-11 h-11 rounded-md text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 transition-colors"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Link groups */}
          <div className="mt-8 md:mt-0 md:col-span-7 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-3 md:gap-8">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Company
              </h4>
              <ul className="flex flex-col">
                <li><a href="/worker-signup" className={linkCls}>Join Our Team</a></li>
                <li><a href="/worker-login" className={linkCls}>Technician Portal</a></li>
                <li><a href="tel:+17372729971" className={linkCls}>Contact Us</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Legal
              </h4>
              <ul className="flex flex-col">
                <li><Link to="/privacy-policy" className={linkCls}>Privacy Policy</Link></li>
                <li><Link to="/terms-of-service" className={linkCls}>Terms of Service</Link></li>
              </ul>
            </div>

            <div className="col-span-2 md:col-span-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Service Areas
              </h4>
              <ul className="grid grid-cols-2 gap-x-4">
                {cities.map((c) => (
                  <li key={c.href}>
                    <a href={c.href} className={linkCls}>{c.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-4 border-t border-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p className="text-xs text-slate-500 text-center md:text-left">
            © 2026 Hero TV Mounting. All rights reserved.
          </p>
          <p className="text-xs text-slate-500 text-center md:text-right">
            Developed by{' '}
            <a
              href="https://www.charusolutions.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Charu Solutions
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
