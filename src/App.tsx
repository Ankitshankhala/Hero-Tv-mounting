
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { TestingModeProvider } from '@/contexts/TestingModeContext';
import { Toaster } from '@/components/ui/toaster';
import { useSecurityHeaders } from '@/hooks/useSecurityHeaders';
import Index from '@/pages/Index';
import BookingSuccess from '@/pages/BookingSuccess';
import CustomerDashboard from '@/pages/CustomerDashboard';
import WorkerDashboard from '@/pages/WorkerDashboard';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/NotFound';
import WorkerSignup from '@/pages/WorkerSignup';
import WorkerLogin from '@/pages/WorkerLogin';

const queryClient = new QueryClient();

function AppWithSecurity() {
  useSecurityHeaders({
    enableCSP: true,
    enableHSTS: true,
    enableXFrameOptions: true,
    enableContentTypeOptions: true,
    enableReferrerPolicy: true
  });

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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestingModeProvider>
          <Toaster />
          <AppWithSecurity />
        </TestingModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
