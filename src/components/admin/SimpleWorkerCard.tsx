import React from 'react';
import { Badge } from '@/components/ui/badge';

interface Worker {
  id: string;
  name: string;
  is_active: boolean;
  zcta_zipcodes?: number; // ZCTA-computed unique ZIP count
  zcta_total_area_zipcodes?: number; // ZCTA-computed total area ZIP count (with duplicates)
  service_areas?: Array<{
    id: string;
    area_name: string;
    polygon_coordinates: any;
    is_active: boolean;
    created_at: string;
  }>;
  service_zipcodes?: Array<{
    zipcode: string;
    service_area_id: string;
  }>;
}

interface SimpleWorkerCardProps {
  worker: Worker;
  isSelected?: boolean;
  onClick?: () => void;
  colorIndex?: number;
}

const WORKER_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red  
  '#8B5CF6', // purple
  '#F59E0B', // orange
  '#10B981', // green
  '#EC4899', // pink
];

export const SimpleWorkerCard: React.FC<SimpleWorkerCardProps> = ({
  worker,
  isSelected = false,
  onClick,
  colorIndex = 0
}) => {
  const getWorkerCoverageDisplay = (worker: Worker) => {
    const activeAreas = worker.service_areas?.filter(area => area.is_active) || [];
    const areaCount = activeAreas.length;
    
    // Use ZCTA-computed ZIP counts if available, otherwise fall back to database count
    const uniqueZipCount = worker.zcta_zipcodes || worker.service_zipcodes?.length || 0;
    const totalZipCount = worker.zcta_total_area_zipcodes || uniqueZipCount;
    
    if (areaCount === 0) return '0 areas';
    
    // Format with proper singular/plural
    const areaText = areaCount === 1 ? 'area' : 'areas';
    const uniqueZipText = uniqueZipCount === 1 ? 'ZIP' : 'ZIPs';
    
    if (uniqueZipCount > 0) {
      // Show both metrics when they differ (indicating overlap)
      if (totalZipCount > uniqueZipCount) {
        return `${areaCount} ${areaText}, ${totalZipCount} total ZIPs (${uniqueZipCount} unique)`;
      }
      
      // Show simple format when no overlap
      return `${areaCount} ${areaText}, ${uniqueZipCount} ${uniqueZipText}`;
    }
    
    return `${areaCount} ${areaText}`;
  };

  const workerColor = WORKER_COLORS[colorIndex % WORKER_COLORS.length];
  const coverageDisplay = getWorkerCoverageDisplay(worker);

  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted/50 ${
        isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:border-border/50'
      }`}
      onClick={onClick}
    >
      {/* Color indicator dot */}
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: workerColor }}
      />
      
      {/* Worker info */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">
            {worker.name}
          </span>
          {!worker.is_active && (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
        
        {/* Coverage display */}
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {coverageDisplay}
        </span>
      </div>
    </div>
  );
};