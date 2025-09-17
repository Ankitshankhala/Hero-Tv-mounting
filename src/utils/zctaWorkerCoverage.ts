import { polygon, bbox } from '@turf/turf';
import { unifiedZctaManager } from '@/services/unifiedZctaManager';

export interface WorkerZctaCoverage {
  workerId: string;
  areaId: string;
  zctaZipcodes: string[];
  computedAt: Date;
}

export interface WorkerAreaZctaStats {
  workerId: string;
  activeAreaCount: number;
  totalZctaZipcodes: number;
  zctaCoverageByArea: Map<string, string[]>;
}

/**
 * Computes ZCTA ZIP code coverage for a single service area polygon
 */
export const computeZctaZipCodesForPolygon = async (polygonCoords: any): Promise<string[]> => {
  if (!unifiedZctaManager.isReady()) {
    console.warn('ZCTA data not ready');
    return [];
  }

  try {
    // Convert polygon coordinates to GeoJSON if needed
    let geoJsonPolygon;
    if (polygonCoords?.type === 'Polygon') {
      geoJsonPolygon = polygonCoords;
    } else if (Array.isArray(polygonCoords)) {
      // Handle array of lat/lng objects or coordinate pairs
      const coords = polygonCoords.map(coord => {
        if (typeof coord === 'object' && 'lat' in coord && 'lng' in coord) {
          return [coord.lng, coord.lat];
        }
        return coord;
      });
      
      // Ensure polygon is closed
      if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push(coords[0]);
      }
      
      geoJsonPolygon = {
        type: 'Polygon',
        coordinates: [coords]
      };
    } else {
      console.warn('Invalid polygon coordinates format');
      return [];
    }

    const spatialIndex = unifiedZctaManager.getSpatialIndex();
    if (!spatialIndex || spatialIndex.length === 0) {
      console.warn('ZCTA spatial index is empty');
      return [];
    }

    const intersectingZips: string[] = [];
    
    // Get polygon bounds for filtering
    const servicePolygon = polygon(geoJsonPolygon.coordinates);
    const serviceBbox = bbox(servicePolygon);
    const [minLng, minLat, maxLng, maxLat] = serviceBbox;
    
    // Use bounds-based approach for performance - check bbox overlap
    spatialIndex.forEach((entry) => {
      try {
        const [entryMinLng, entryMinLat, entryMaxLng, entryMaxLat] = entry.bbox;
        
        // Check if bounding boxes overlap (simpler and faster)
        if (minLng <= entryMaxLng && maxLng >= entryMinLng &&
            minLat <= entryMaxLat && maxLat >= entryMinLat) {
          intersectingZips.push(entry.zipcode);
        }
      } catch (error) {
        console.warn(`Error checking overlap for ZIP ${entry.zipcode}:`, error);
      }
    });

    return intersectingZips.sort();
  } catch (error) {
    console.error('Error computing ZCTA ZIP codes for polygon:', error);
    return [];
  }
};

/**
 * Computes ZCTA coverage statistics for a worker's active service areas
 */
export const computeWorkerZctaStats = async (
  serviceAreas: Array<{
    id: string;
    polygon_coordinates?: any;
    is_active: boolean;
  }>
): Promise<WorkerAreaZctaStats> => {
  const activeAreas = serviceAreas.filter(area => area.is_active);
  const zctaCoverageByArea = new Map<string, string[]>();
  const allZipcodes = new Set<string>();

  // Compute ZCTA coverage for each active area
  for (const area of activeAreas) {
    if (area.polygon_coordinates) {
      const zctaZips = await computeZctaZipCodesForPolygon(area.polygon_coordinates);
      zctaCoverageByArea.set(area.id, zctaZips);
      
      // Add to total unique ZIP set
      zctaZips.forEach(zip => allZipcodes.add(zip));
    } else {
      zctaCoverageByArea.set(area.id, []);
    }
  }

  return {
    workerId: '', // Will be set by caller
    activeAreaCount: activeAreas.length,
    totalZctaZipcodes: allZipcodes.size,
    zctaCoverageByArea
  };
};

/**
 * Batch compute ZCTA coverage for multiple workers
 */
export const batchComputeWorkerZctaStats = async (
  workers: Array<{
    id: string;
    service_areas?: Array<{
      id: string;
      polygon_coordinates?: any;
      is_active: boolean;
    }>;
  }>
): Promise<Map<string, WorkerAreaZctaStats>> => {
  // Ensure ZCTA data is loaded
  await unifiedZctaManager.loadZctaData();
  
  const results = new Map<string, WorkerAreaZctaStats>();
  
  // Process workers in parallel for better performance
  const workerPromises = workers.map(async (worker) => {
    if (worker.service_areas && worker.service_areas.length > 0) {
      const stats = await computeWorkerZctaStats(worker.service_areas);
      stats.workerId = worker.id;
      return { workerId: worker.id, stats };
    }
    return { 
      workerId: worker.id, 
      stats: {
        workerId: worker.id,
        activeAreaCount: 0,
        totalZctaZipcodes: 0,
        zctaCoverageByArea: new Map()
      }
    };
  });
  
  const workerResults = await Promise.all(workerPromises);
  
  workerResults.forEach(({ workerId, stats }) => {
    results.set(workerId, stats);
  });
  
  return results;
};