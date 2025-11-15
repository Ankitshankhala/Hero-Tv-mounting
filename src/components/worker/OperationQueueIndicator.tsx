import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OperationQueueIndicatorProps {
  isProcessing: boolean;
  queueLength: number;
}

export const OperationQueueIndicator = ({ isProcessing, queueLength }: OperationQueueIndicatorProps) => {
  if (!isProcessing && queueLength === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border">
      {isProcessing && (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      )}
      <span className="text-sm text-muted-foreground">
        {isProcessing ? 'Processing operation...' : 'Operations queued'}
      </span>
      {queueLength > 0 && (
        <Badge variant="secondary" className="text-xs">
          {queueLength} pending
        </Badge>
      )}
    </div>
  );
};
