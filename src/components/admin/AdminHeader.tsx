import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, ArrowLeft, TestTube, Clock, DollarSign, AlertTriangle, RotateCcw } from 'lucide-react';
import { useTestingMode } from '@/contexts/TestingModeContext';
import { useToast } from '@/hooks/use-toast';
import { useTour } from '@/contexts/TourContext';
import { AssignWorkerModal } from './AssignWorkerModal';
import { TodaysJobsModal } from './TodaysJobsModal';
import { supabase } from '@/integrations/supabase/client';
import { ArrowSidebarToggle } from './ArrowSidebarToggle';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
interface AdminHeaderProps {
  onNavigate?: (section: string) => void;
}
export const AdminHeader = ({
  onNavigate
}: AdminHeaderProps = {}) => {
  const [showAssignWorker, setShowAssignWorker] = useState(false);
  const [showTodaysJobs, setShowTodaysJobs] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<'checking' | 'live' | 'test' | 'error'>('checking');
  const {
    isTestingMode,
    timeRemaining,
    activateTestingMode,
    deactivateTestingMode
  } = useTestingMode();
  const {
    toast
  } = useToast();
  const {
    resetTourCompletion
  } = useTour();

  // Check Stripe configuration on mount
  React.useEffect(() => {
    const checkStripeConfig = async () => {
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('test-stripe-config');
        if (error) throw error;
        setStripeStatus(data.keyType === 'live' ? 'live' : 'test');
      } catch (error) {
        console.error('Stripe config check failed:', error);
        setStripeStatus('error');
      }
    };
    checkStripeConfig();
  }, []);
  const handleTestingModeActivate = () => {
    activateTestingMode();
    toast({
      title: "🧪 Testing Mode Activated",
      description: "Payment minimum reduced to $1 for 10 minutes. ONLY use with LIVE Stripe keys!",
      variant: "default",
      duration: 5000
    });
  };
  const handleTestingModeDeactivate = () => {
    deactivateTestingMode();
    toast({
      title: "Testing Mode Deactivated",
      description: "Payment minimum restored to $75",
      variant: "default"
    });
  };
  const handleResetTour = async () => {
    try {
      const success = await resetTourCompletion();
      if (success) {
        toast({
          title: "Tour Reset",
          description: "Admin tour completion status has been reset. Refresh the page to see the tour again.",
          variant: "default"
        });
      } else {
        toast({
          title: "Reset Failed",
          description: "Failed to reset tour completion status.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error resetting tour:', error);
      toast({
        title: "Reset Failed",
        description: "An error occurred while resetting the tour.",
        variant: "destructive"
      });
    }
  };
  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  return <>
      <header className="bg-slate-800/30 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <ArrowSidebarToggle />
            <Link to="/">
              <Button variant="outline" size="sm" className="bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-white hover:text-slate-900 transition-colors">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Site
              </Button>
            </Link>
            <div className="border-l border-slate-600 pl-4">
              <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
              <p className="text-slate-300">Manage your TV mounting business</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Global Search */}
            <GlobalSearch onNavigate={onNavigate || (() => {})} />
            
            {/* Notifications */}
            <NotificationBell />
            
            {/* Stripe Status Indicator */}
            <Badge variant={stripeStatus === 'live' ? 'default' : stripeStatus === 'test' ? 'secondary' : 'destructive'} className={stripeStatus === 'live' ? 'bg-green-600' : ''}>
              {stripeStatus === 'checking' && '🔄 Checking...'}
              {stripeStatus === 'live' && '✅ Live Keys'}
              {stripeStatus === 'test' && '⚠️ Test Keys'}
              {stripeStatus === 'error' && '❌ Config Error'}
            </Badge>
            
            {/* Testing Mode Status & Controls */}
            {isTestingMode ? <div className="flex items-center space-x-2">
                <Badge variant="destructive" className="animate-pulse">
                  <TestTube className="h-3 w-3 mr-1" />
                  TESTING MODE ACTIVE
                </Badge>
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatTimeRemaining(timeRemaining)}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleTestingModeDeactivate} className="bg-red-900/20 text-red-400 border-red-600/50 hover:bg-red-600 hover:text-white transition-colors">
                  Deactivate Testing
                </Button>
              </div> : <AlertDialog>
                <AlertDialogTrigger asChild>
                  
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                      Activate Testing Mode
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reduce the minimum payment to $1 for 10 minutes. 
                      <strong> Only use this with LIVE Stripe keys for real testing!</strong>
                      <br /><br />
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        <DollarSign className="h-3 w-3 mr-1" />
                        $75 → $1 minimum
                      </Badge>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleTestingModeActivate} className="bg-orange-600 hover:bg-orange-700">
                      Activate Testing Mode
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>}
            
            
            
            {/* Tour Reset Button */}
            <Button variant="outline" size="sm" onClick={handleResetTour} className="bg-blue-900/20 text-blue-400 border-blue-600/50 hover:bg-blue-600 hover:text-white transition-colors" title="Reset admin tour completion status">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Tour
            </Button>
          </div>
        </div>
      </header>

      {showAssignWorker && <AssignWorkerModal onClose={() => setShowAssignWorker(false)} />}
      {showTodaysJobs && <TodaysJobsModal onClose={() => setShowTodaysJobs(false)} />}
    </>;
};