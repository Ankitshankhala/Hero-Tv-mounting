
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield } from 'lucide-react';

interface BookingFlowNavigationProps {
  currentStep: number;
  loading: boolean;
  isStep1Valid: boolean;
  isStep2Valid: boolean;
  isStep3Valid: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  onBookingSubmit: () => void;
}

export const BookingFlowNavigation = ({
  currentStep,
  loading,
  isStep1Valid,
  isStep2Valid,
  isStep3Valid,
  onPrevStep,
  onNextStep,
  onBookingSubmit
}: BookingFlowNavigationProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-600/50 bg-slate-800/30 rounded-xl p-4 space-y-4 sm:space-y-0 backdrop-blur-sm">
      <div className="flex items-center space-x-2">
        <Shield className="h-4 w-4 text-green-400" />
        <span className="text-sm text-slate-300">Secure & encrypted</span>
      </div>

      <div className="flex space-x-3 w-full sm:w-auto">
        {currentStep > 1 && (
          <Button
            variant="outline"
            onClick={onPrevStep}
            className="flex-1 sm:flex-none bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 hover:border-slate-500"
            disabled={loading}
          >
            Back
          </Button>
        )}
        
        {currentStep < 3 && (
          <Button
            onClick={onNextStep}
            disabled={
              (currentStep === 1 && !isStep1Valid) ||
              (currentStep === 2 && !isStep2Valid) ||
              loading
            }
            className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white border-0"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading...
              </>
            ) : (
              <>
                Next Step
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}

        {currentStep === 3 && (
          <Button
            onClick={onBookingSubmit}
            disabled={!isStep3Valid || loading}
            className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white border-0"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                Create Booking
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
