
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Book from "./pages/Book";
import Admin from "./pages/Admin";
import WorkerDashboard from "./pages/WorkerDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import WorkerApplication from "./pages/WorkerApplication";
import BookingSuccess from "./pages/BookingSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on authentication errors
        if (error?.message?.includes('row-level security') || error?.code === 'PGRST116') {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/book" element={<Book />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/worker-dashboard" element={<WorkerDashboard />} />
            <Route path="/customer-dashboard" element={<CustomerDashboard />} />
            <Route path="/worker-application" element={<WorkerApplication />} />
            <Route path="/booking-success" element={<BookingSuccess />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
