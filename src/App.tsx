
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { TestingModeProvider } from '@/contexts/TestingModeContext';
import { ServicesCacheProvider } from '@/contexts/ServicesCacheContext';
import { Toaster } from '@/components/ui/toaster';
import { useSecurityHeaders } from '@/hooks/useSecurityHeaders';
import { preloadZipIndex } from '@/utils/localZipIndex';
import { HelmetProvider } from 'react-helmet-async';

// Eager load only the main landing page for fastest initial render
import Index from '@/pages/Index';

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-900">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

// Lazy load all other pages - they're not needed for initial render
const BookingSuccess = lazy(() => import('@/pages/BookingSuccess'));
const CustomerDashboard = lazy(() => import('@/pages/CustomerDashboard'));
const WorkerDashboard = lazy(() => import('@/pages/WorkerDashboard'));
const Admin = lazy(() => import('@/pages/Admin'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const WorkerSignup = lazy(() => import('@/pages/WorkerSignup'));
const WorkerLogin = lazy(() => import('@/pages/WorkerLogin'));
const CityPage = lazy(() => import('@/pages/cities/CityPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppWithSecurity() {
  useSecurityHeaders({
    enableCSP: true,
    enableHSTS: true,
    enableXFrameOptions: true,
    enableContentTypeOptions: true,
    enableReferrerPolicy: true
  });

  // Preload ZIP index on app startup for instant lookups - deferred to idle time
  useEffect(() => {
    const preload = () => {
      preloadZipIndex().catch(console.warn);
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout with longer delay
    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload, { timeout: 3000 });
    } else {
      setTimeout(preload, 2000);
    }
  }, []);

  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/booking-success" element={<BookingSuccess />} />
          <Route path="/customer-dashboard" element={<CustomerDashboard />} />
          <Route path="/worker-dashboard" element={<WorkerDashboard />} />
          <Route path="/worker-signup" element={<WorkerSignup />} />
          <Route path="/worker-login" element={<WorkerLogin />} />
          <Route path="/admin" element={<Admin />} />
          
          {/* City landing pages */}
          <Route path="/locations/:slug" element={<CityPage />} />
          <Route path="/austin-tv-mounting" element={<CityPage />} />
          <Route path="/san-antonio-tv-mounting" element={<CityPage />} />
          <Route path="/fort-worth-tv-mounting" element={<CityPage />} />
          <Route path="/dallas-tv-mounting" element={<CityPage />} />
          <Route path="/houston-tv-mounting" element={<CityPage />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HelmetProvider>
          <ServicesCacheProvider>
            <TestingModeProvider>
              <Toaster />
              <AppWithSecurity />
            </TestingModeProvider>
          </ServicesCacheProvider>
        </HelmetProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
