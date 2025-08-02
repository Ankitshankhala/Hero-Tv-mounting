import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTestingMode } from '@/contexts/TestingModeContext';
import { TestTube, Clock, DollarSign } from 'lucide-react';

export const TestingModeIndicator = () => {
  const { isTestingMode, timeRemaining } = useTestingMode();

  if (!isTestingMode) return null;

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <TestTube className="h-5 w-5 text-orange-600" />
          <span className="text-orange-800 font-semibold">Testing Mode Active</span>
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            <DollarSign className="h-3 w-3 mr-1" />
            $1 minimum
          </Badge>
        </div>
        <Badge variant="outline" className="text-orange-600 border-orange-300">
          <Clock className="h-3 w-3 mr-1" />
          {formatTimeRemaining(timeRemaining)} remaining
        </Badge>
      </div>
      <p className="text-orange-700 text-sm mt-2">
        ⚠️ Using LIVE payment processing with reduced minimum for testing purposes
      </p>
    </div>
  );
};