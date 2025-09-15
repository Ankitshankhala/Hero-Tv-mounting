import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load heavy components to improve initial page load
export const LazyEnhancedWorkerServiceAreasMapImproved = lazy(
  () => import('./EnhancedWorkerServiceAreasMapImproved').then(module => ({
    default: module.EnhancedWorkerServiceAreasMapImproved
  }))
);

export const LazyAdminServiceAreaMap = lazy(
  () => import('./AdminServiceAreaMap')
);

export const LazyAdminZipCodeManager = lazy(
  () => import('./AdminZipCodeManager')
);


// Loading component for lazy-loaded admin components
export const AdminComponentLoader = () => (
  <div className="flex items-center justify-center h-96 bg-background/50">
    <div className="flex items-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Loading component...</span>
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