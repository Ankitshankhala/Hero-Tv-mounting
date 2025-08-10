import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, ArrowLeft, TestTube, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { useTestingMode } from '@/contexts/TestingModeContext';
import { useToast } from '@/hooks/use-toast';
import { AssignWorkerModal } from './AssignWorkerModal';
import { TodaysJobsModal } from './TodaysJobsModal';
import { supabase } from '@/integrations/supabase/client';
export const AdminHeader = () => {
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
  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  return <>
      <header className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Site
              </Button>
            </Link>
            <div className="border-l border-gray-300 pl-4">
              <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
              <p className="text-gray-600">Manage your TV mounting business</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
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
                <Button variant="outline" size="sm" onClick={handleTestingModeDeactivate} className="text-red-600 border-red-300 hover:bg-red-50">
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
                    <AlertDialogDescription className="space-y-2">
                      <p>This will reduce the minimum booking amount from <strong>$75 to $1</strong> for 10 minutes.</p>
                      <div className="bg-orange-50 p-3 rounded-md border border-orange-200">
                        <p className="text-orange-800 font-medium">⚠️ IMPORTANT:</p>
                        <ul className="text-orange-700 text-sm mt-1 space-y-1">
                          <li>• ONLY use with LIVE Stripe keys</li>
                          <li>• Real payments will be processed</li>
                          <li>• Use for final testing before launch</li>
                        </ul>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleTestingModeActivate} className="bg-blue-600 hover:bg-blue-700">
                      Activate Testing Mode
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>}
            
            <Button variant="outline" onClick={() => setShowTodaysJobs(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Today's Jobs
            </Button>
          </div>
        </div>
      </header>

      {showAssignWorker && <AssignWorkerModal onClose={() => setShowAssignWorker(false)} />}
      {showTodaysJobs && <TodaysJobsModal onClose={() => setShowTodaysJobs(false)} />}
    </>;
};