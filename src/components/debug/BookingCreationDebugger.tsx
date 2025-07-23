import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, AlertTriangle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BookingStep {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error' | 'warning';
  message?: string;
  timestamp?: Date;
  details?: any;
  errorId?: string;
}

interface BookingCreationDebuggerProps {
  isVisible?: boolean;
  operationId?: string;
  onClose?: () => void;
}

export const BookingCreationDebugger: React.FC<BookingCreationDebuggerProps> = ({ 
  isVisible = false, 
  operationId,
  onClose 
}) => {
  const [steps, setSteps] = useState<BookingStep[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  // Initialize steps when component mounts or operationId changes
  useEffect(() => {
    if (operationId) {
      setSteps([
        { id: 'validation', name: 'Input Validation', status: 'pending' },
        { id: 'customer', name: 'Customer Processing', status: 'pending' },
        { id: 'payment', name: 'Payment Authorization', status: 'pending' },
        { id: 'booking', name: 'Booking Creation', status: 'pending' },
        { id: 'transaction', name: 'Transaction Recording', status: 'pending' },
        { id: 'worker', name: 'Worker Assignment', status: 'pending' },
        { id: 'completion', name: 'Process Completion', status: 'pending' }
      ]);
    }
  }, [operationId]);

  // Listen for console logs to update step status
  useEffect(() => {
    if (!operationId) return;

    const originalLog = console.log;
    const originalError = console.error;

    const updateStepFromLog = (level: 'log' | 'error', message: string, ...args: any[]) => {
      const messageStr = typeof message === 'string' ? message : String(message);
      
      // Parse different log patterns to update steps
      if (messageStr.includes('Starting booking submission')) {
        updateStep('validation', 'in-progress', 'Validating booking data...');
      } else if (messageStr.includes('All validations passed')) {
        updateStep('validation', 'completed', 'All validations passed');
        updateStep('customer', 'in-progress', 'Processing customer information...');
      } else if (messageStr.includes('Customer ID established')) {
        updateStep('customer', 'completed', 'Customer processing complete');
        updateStep('payment', 'in-progress', 'Processing payment authorization...');
      } else if (messageStr.includes('Payment authorized successfully')) {
        updateStep('payment', 'completed', 'Payment authorization successful');
        updateStep('booking', 'in-progress', 'Creating booking record...');
      } else if (messageStr.includes('Temporary booking created')) {
        updateStep('booking', 'completed', 'Booking created successfully');
        updateStep('transaction', 'in-progress', 'Recording transaction...');
      } else if (messageStr.includes('Transaction ready')) {
        updateStep('transaction', 'completed', 'Transaction recorded');
        updateStep('worker', 'in-progress', 'Assigning workers...');
      } else if (messageStr.includes('Worker assigned') || messageStr.includes('Coverage requests sent')) {
        updateStep('worker', 'completed', 'Worker assignment complete');
        updateStep('completion', 'completed', 'Booking process completed successfully');
      } else if (level === 'error' && messageStr.includes('CRITICAL')) {
        // Extract error ID if present
        const errorIdMatch = messageStr.match(/\[([^\]]+)\]/);
        const errorId = errorIdMatch ? errorIdMatch[1] : undefined;
        
        // Determine which step failed based on error context
        if (messageStr.includes('validation')) {
          updateStep('validation', 'error', 'Validation failed', errorId);
        } else if (messageStr.includes('customer') || messageStr.includes('guest')) {
          updateStep('customer', 'error', 'Customer processing failed', errorId);
        } else if (messageStr.includes('payment') || messageStr.includes('stripe')) {
          updateStep('payment', 'error', 'Payment authorization failed', errorId);
        } else if (messageStr.includes('booking')) {
          updateStep('booking', 'error', 'Booking creation failed', errorId);
        } else if (messageStr.includes('transaction')) {
          updateStep('transaction', 'error', 'Transaction recording failed', errorId);
        } else if (messageStr.includes('worker') || messageStr.includes('assignment')) {
          updateStep('worker', 'warning', 'Worker assignment issues');
        } else {
          updateStep('completion', 'error', 'Process failed', errorId);
        }
      }
    };

    // Override console methods
    console.log = (message: any, ...args: any[]) => {
      originalLog(message, ...args);
      updateStepFromLog('log', message, ...args);
    };

    console.error = (message: any, ...args: any[]) => {
      originalError(message, ...args);
      updateStepFromLog('error', message, ...args);
    };

    // Cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, [operationId]);

  const updateStep = (stepId: string, status: BookingStep['status'], message?: string, errorId?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { 
            ...step, 
            status, 
            message, 
            timestamp: new Date(),
            errorId 
          }
        : step
    ));
  };

  const getStepIcon = (status: BookingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStepBadge = (status: BookingStep['status']) => {
    const variants = {
      'completed': 'default',
      'error': 'destructive',
      'warning': 'secondary',
      'in-progress': 'default',
      'pending': 'outline'
    } as const;

    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const copyDebugInfo = () => {
    const debugInfo = {
      operationId,
      timestamp: new Date().toISOString(),
      steps: steps.map(step => ({
        ...step,
        timestamp: step.timestamp?.toISOString()
      }))
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    toast({
      title: "Debug Info Copied",
      description: "Debug information has been copied to clipboard",
    });
  };

  if (!isVisible) return null;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Booking Creation Progress</CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyDebugInfo}
              className="flex items-center space-x-1"
            >
              <Copy className="h-3 w-3" />
              <span>Copy Debug Info</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
        {operationId && (
          <p className="text-sm text-muted-foreground">
            Operation ID: <code className="bg-gray-100 px-1 rounded">{operationId}</code>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center space-x-3 p-3 rounded-lg border">
              {getStepIcon(step.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{step.name}</span>
                  {getStepBadge(step.status)}
                </div>
                {step.message && (
                  <p className="text-sm text-muted-foreground mt-1">{step.message}</p>
                )}
                {step.errorId && (
                  <p className="text-xs text-red-600 mt-1">
                    Error ID: <code className="bg-red-50 px-1 rounded">{step.errorId}</code>
                  </p>
                )}
                {isExpanded && step.timestamp && (
                  <p className="text-xs text-gray-500 mt-1">
                    {step.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {isExpanded && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Debug Tips:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Check browser console for detailed error messages</li>
              <li>• Copy debug info to share with support</li>
              <li>• Red steps indicate critical failures requiring attention</li>
              <li>• Yellow steps indicate warnings but process may continue</li>
              <li>• Blue spinning icons indicate active processing</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingCreationDebugger;