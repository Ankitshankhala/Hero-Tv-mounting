import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, X } from 'lucide-react';

interface ServiceAreaPopupProps {
  area: {
    id: string;
    area_name: string;
    is_active: boolean;
    created_at: string;
    worker: {
      id: string;
      name: string;
      email: string;
    };
  };
  zipCodes: string[];
  loading: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export const ServiceAreaPopup: React.FC<ServiceAreaPopupProps> = ({
  area,
  zipCodes,
  loading,
  onClose,
  position
}) => {
  // Smart positioning to stay within viewport bounds
  const getPopupStyle = () => {
    const maxWidth = 320;
    const maxHeight = 400;
    
    let left = position.x;
    let top = position.y;
    
    // Adjust if too close to right edge
    if (left + maxWidth > window.innerWidth - 20) {
      left = window.innerWidth - maxWidth - 20;
    }
    
    // Adjust if too close to bottom edge  
    if (top + maxHeight > window.innerHeight - 20) {
      top = window.innerHeight - maxHeight - 20;
    }
    
    // Ensure not too close to top/left edges
    left = Math.max(20, left);
    top = Math.max(20, top);
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 1200,
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`,
    };
  };

  return (
    <Card 
      className="bg-background/98 backdrop-blur-md border-2 shadow-2xl"
      style={getPopupStyle()}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base truncate pr-2">{area.area_name}</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-muted/80"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pb-4">
        {/* Worker Information */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground/90">Worker</h4>
          <div className="space-y-1">
            <p className="text-sm text-foreground">{area.worker.name}</p>
            <p className="text-xs text-muted-foreground">{area.worker.email}</p>
          </div>
        </div>
        
        {/* Status */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground/90">Status</h4>
          <Badge variant={area.is_active ? 'default' : 'secondary'}>
            {area.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* ZCTA-Based ZIP Codes */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground/90">ZCTA Coverage</h4>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Computing ZCTA intersections...
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {zipCodes.length} ZCTA ZIP codes in this area
              </p>
              <ScrollArea className="h-24 w-full border rounded-md p-2 bg-muted/30">
                <div className="grid grid-cols-3 gap-1">
                  {zipCodes.map((zipcode) => (
                    <Badge 
                      key={zipcode} 
                      variant="outline" 
                      className="text-xs justify-center bg-background/80 hover:bg-background"
                    >
                      {zipcode}
                    </Badge>
                  ))}
                </div>
                {zipCodes.length === 0 && !loading && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No ZCTA intersections found
                  </p>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Creation Date */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground/90">Created</h4>
          <p className="text-sm text-muted-foreground">
            {new Date(area.created_at).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};