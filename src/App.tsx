
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { TestingModeProvider } from '@/contexts/TestingModeContext';
import { ServicesCacheProvider } from '@/contexts/ServicesCacheContext';
import { Toaster } from '@/components/ui/toaster';
import { useSecurityHeaders } from '@/hooks/useSecurityHeaders';
import { preloadZipIndex } from '@/utils/localZipIndex';
import Index from '@/pages/Index';
import BookingSuccess from '@/pages/BookingSuccess';
import CustomerDashboard from '@/pages/CustomerDashboard';
import WorkerDashboard from '@/pages/WorkerDashboard';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/NotFound';
import WorkerSignup from '@/pages/WorkerSignup';
import WorkerLogin from '@/pages/WorkerLogin';
import CityPage from '@/pages/cities/CityPage';
import { HelmetProvider } from 'react-helmet-async';

const queryClient = new QueryClient();

function AppWithSecurity() {
  useSecurityHeaders({
    enableCSP: true,
    enableHSTS: true,
    enableXFrameOptions: true,
    enableContentTypeOptions: true,
    enableReferrerPolicy: true
  });

  // Preload ZIP index on app startup for instant lookups
  useEffect(() => {
    const preload = () => {
      preloadZipIndex().catch(console.warn);
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload);
    } else {
      setTimeout(preload, 0);
    }
  }, []);

  return (
    <Router>
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
