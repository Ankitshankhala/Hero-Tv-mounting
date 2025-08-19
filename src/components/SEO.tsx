
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

export const SEO: React.FC<SEOProps> = ({ title, description, canonical, noindex, jsonLd }) => {
  const safeDescription = description?.slice(0, 155);
  const currentUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
  const canonicalUrl = canonical || currentUrl;

  return (
    <Helmet>
      <title>{title}</title>
      {safeDescription && <meta name="description" content={safeDescription} />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph tags */}
      {title && <meta property="og:title" content={title} />}
      {safeDescription && <meta property="og:description" content={safeDescription} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:type" content="website" />
      <meta property="og:image" content="/assets/images/og-image.png" />
      
      {/* Twitter Card tags */}
      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {safeDescription && <meta name="twitter:description" content={safeDescription} />}
      <meta name="twitter:image" content="/assets/images/twitter-image.png" />
      
      {/* Single H1 rule is enforced in pages; this component manages head only */}
      {Array.isArray(jsonLd)
        ? jsonLd.map((schema, i) => (
            <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
          ))
        : jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
};

export default SEO;
