
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
