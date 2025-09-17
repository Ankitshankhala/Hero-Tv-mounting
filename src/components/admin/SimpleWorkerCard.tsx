import React from 'react';
import { Badge } from '@/components/ui/badge';

interface Worker {
  id: string;
  name: string;
  is_active: boolean;
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
  const getWorkerAreaCode = (worker: Worker) => {
    const activeAreas = worker.service_areas?.filter(area => area.is_active) || [];
    const totalZips = worker.service_zipcodes?.length || 0;
    
    if (activeAreas.length === 0) return '0';
    
    // Create a simplified area code like "1a+54z" 
    const areaCount = activeAreas.length;
    const firstAreaId = activeAreas[0]?.id?.slice(-2) || 'xx';
    
    if (totalZips > 0) {
      return `${areaCount}a+${totalZips}z`;
    }
    
    return `${areaCount}a`;
  };

  const workerColor = WORKER_COLORS[colorIndex % WORKER_COLORS.length];
  const areaCode = getWorkerAreaCode(worker);

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
        
        {/* Area code */}
        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
          {areaCode}
        </span>
      </div>
    </div>
  );
};