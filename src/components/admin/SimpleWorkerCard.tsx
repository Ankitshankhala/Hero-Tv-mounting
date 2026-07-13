import React from 'react';
import { Badge } from '@/components/ui/badge';

interface Worker {
  id: string;
  name: string;
  is_active: boolean;
  total_zipcodes?: number;
  service_area_count?: number;
  // Removed zcta_zipcodes references - now using us_zcta_polygons directly
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

    // Prefer server-computed distinct ZIP count. Fall back to distinct zipcodes
    // from the loaded rows only if the server value is missing.
    const uniqueZipCount = typeof worker.total_zipcodes === 'number'
      ? worker.total_zipcodes
      : new Set((worker.service_zipcodes || []).map(z => z.zipcode)).size;

    const areaText = areaCount === 1 ? 'area' : 'areas';
    const zipText = uniqueZipCount === 1 ? 'ZIP' : 'ZIPs';

    // Always show the ZIP count — workers can have ZIPs with no polygon area,
    // and areas with no ZIPs; both facts matter.
    return `${areaCount} ${areaText}, ${uniqueZipCount} ${zipText}`;
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