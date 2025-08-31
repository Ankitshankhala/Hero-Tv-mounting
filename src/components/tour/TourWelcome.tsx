import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PlayCircle, X } from 'lucide-react';
import { useTour } from '@/contexts/TourContext';
import { useAuth } from '@/hooks/useAuth';
import { createPortal } from 'react-dom';

export function TourWelcome() {
  const { showWelcome, startTour, skipTour } = useTour();
  const { profile } = useAuth();

  if (!showWelcome || !profile) return null;

  const tourType = profile.role === 'admin' ? 'admin' : 'worker';
  const dashboardName = profile.role === 'admin' ? 'Admin Panel' : 'Worker Dashboard';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <Card className="w-full max-w-md bg-background border-2 border-primary/20 shadow-2xl animate-scale-in">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Welcome Tour</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTour}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Welcome to the {dashboardName}! Would you like to take a quick guided tour 
              to learn about the key features and how to navigate the interface?
            </p>
            
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                ✨ The tour takes about 2 minutes and will highlight the most important sections.
              </p>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={skipTour}
                className="flex-1"
              >
                Skip Tour
              </Button>
              <Button
                onClick={() => startTour(tourType)}
                className="flex-1 flex items-center gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                Start Tour
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}