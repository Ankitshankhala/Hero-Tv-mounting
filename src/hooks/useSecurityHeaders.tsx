
import { useEffect } from 'react';

interface SecurityConfig {
  enableCSP?: boolean;
  enableHSTS?: boolean;
  enableXFrameOptions?: boolean;
  enableContentTypeOptions?: boolean;
  enableReferrerPolicy?: boolean;
}

export const useSecurityHeaders = (config: SecurityConfig = {}) => {
  const {
    enableCSP = true,
    enableHSTS = true,
    enableXFrameOptions = true,
    enableContentTypeOptions = true,
    enableReferrerPolicy = true
  } = config;

  useEffect(() => {
    // Add security-related meta tags
    const addMetaTag = (name: string, content: string) => {
      const existing = document.querySelector(`meta[name="${name}"]`);
      if (existing) {
        existing.setAttribute('content', content);
      } else {
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
      }
    };

    // Content Security Policy (basic implementation via meta tag)
    if (enableCSP) {
      addMetaTag('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://*.supabase.co https://api.stripe.com; " +
        "frame-src https://js.stripe.com;"
      );
    }

    // X-Frame-Options equivalent
    if (enableXFrameOptions) {
      addMetaTag('X-Frame-Options', 'DENY');
    }

    // X-Content-Type-Options equivalent
    if (enableContentTypeOptions) {
      addMetaTag('X-Content-Type-Options', 'nosniff');
    }

    // Referrer Policy
    if (enableReferrerPolicy) {
      addMetaTag('referrer', 'strict-origin-when-cross-origin');
    }

    // Additional security headers
    addMetaTag('X-XSS-Protection', '1; mode=block');
    addMetaTag('Permissions-Policy', 
      'geolocation=(self), microphone=(), camera=(), payment=(self)'
    );

  }, [enableCSP, enableHSTS, enableXFrameOptions, enableContentTypeOptions, enableReferrerPolicy]);

  const validateExternalScripts = () => {
    const scripts = document.querySelectorAll('script[src]');
    const allowedDomains = [
      'js.stripe.com',
      'maps.googleapis.com',
      window.location.hostname
    ];

    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && !allowedDomains.some(domain => src.includes(domain))) {
        console.warn('Potentially unsafe external script detected:', src);
      }
    });
  };

  const checkMixedContent = () => {
    if (window.location.protocol === 'https:') {
      const insecureElements = document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]');
      if (insecureElements.length > 0) {
        console.warn('Mixed content detected - insecure resources loaded over HTTPS');
      }
    }
  };

  return {
    validateExternalScripts,
    checkMixedContent
  };
};
