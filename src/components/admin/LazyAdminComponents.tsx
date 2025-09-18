import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load heavy components to improve initial page load

export const LazyAdminServiceAreaMap = lazy(
  () => import('./AdminServiceAreaMap')
);

export const LazyAdminZipCodeManager = lazy(
  () => import('./AdminZipCodeManager')
);


// Loading component for lazy-loaded admin components
export const AdminComponentLoader = () => (
  <div className="flex items-center justify-center h-96 bg-background/50">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      <div className="text-center">
        <p className="font-medium">Loading map component...</p>
        <p className="text-sm text-muted-foreground">This may take a moment</p>
      </div>
    </div>
  </div>
);

// Wrapper component with suspense
export const withLazyLoading = (Component: React.ComponentType<any>) => {
  return (props: any) => (
    <Suspense fallback={<AdminComponentLoader />}>
      <Component {...props} />
    </Suspense>
  );
};