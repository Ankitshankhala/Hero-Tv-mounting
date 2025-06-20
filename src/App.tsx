import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient } from 'react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/toaster';
import Index from '@/pages/Index';
import Book from '@/pages/Book';
import BookingSuccess from '@/pages/BookingSuccess';
import CustomerDashboard from '@/pages/CustomerDashboard';
import WorkerDashboard from '@/pages/WorkerDashboard';
import WorkerApplication from '@/pages/WorkerApplication';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/NotFound';
import WorkerSignup from '@/pages/WorkerSignup';

function App() {
  return (
    <QueryClient>
      <AuthProvider>
        <Toaster />
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/book" element={<Book />} />
            <Route path="/booking-success" element={<BookingSuccess />} />
            <Route path="/customer-dashboard" element={<CustomerDashboard />} />
            <Route path="/worker-dashboard" element={<WorkerDashboard />} />
            <Route path="/worker-application" element={<WorkerApplication />} />
            <Route path="/worker-signup" element={<WorkerSignup />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClient>
  );
}

export default App;
