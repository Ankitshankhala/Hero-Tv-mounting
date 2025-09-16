import * as turf from '@turf/turf';
import { useZctaBoundaries } from '@/hooks/useZctaBoundaries';

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface ZipcodeIntersectionResult {
  zipcode: string;
  intersectionArea: number;
  properties: any;
}

export class ClientSpatialOperations {
  private zctaData: GeoJSON.FeatureCollection | null = null;
  private loadingPromise: Promise<void> | null = null;

  // Initialize with ZCTA data loading
  async ensureDataLoaded(): Promise<void> {
    if (this.zctaData) return;
    
    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = this.loadZctaData();
    await this.loadingPromise;
  }

  private async loadZctaData(): Promise<void> {
    try {
      console.log('🌐 Loading ZCTA boundary data from GeoJSON...');
      const response = await fetch('/zcta2020_web.geojson');
      
      if (!response.ok) {
        throw new Error(`Failed to load ZCTA data: ${response.statusText}`);
      }
      
      this.zctaData = await response.json();
      console.log(`✅ Loaded ${this.zctaData?.features?.length || 0} ZCTA boundaries`);
    } catch (error) {
      console.error('❌ Failed to load ZCTA data:', error);
      throw error;
    }
  }

  // Convert polygon points to GeoJSON
  private createGeoJSONPolygon(points: PolygonPoint[]): GeoJSON.Feature<GeoJSON.Polygon> {
    const coordinates = points.map(p => [p.lng, p.lat]);
    // Ensure polygon is closed
    if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
        coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
      coordinates.push(coordinates[0]);
    }
    
    return turf.polygon([coordinates]);
  }

  // Find ZIP codes that intersect with a polygon
  async findIntersectingZipcodes(
    polygonPoints: PolygonPoint[],
    options: {
      includePartial?: boolean;
      minIntersectionRatio?: number;
    } = {}
  ): Promise<ZipcodeIntersectionResult[]> {
    await this.ensureDataLoaded();
    
    if (!this.zctaData || !this.zctaData.features) {
      throw new Error('ZCTA data not loaded');
    }

    const { includePartial = true, minIntersectionRatio = 0.1 } = options;
    const searchPolygon = this.createGeoJSONPolygon(polygonPoints);
    const results: ZipcodeIntersectionResult[] = [];

    console.log(`🔍 Searching ${this.zctaData.features.length} ZCTA features for intersections...`);

    for (const feature of this.zctaData.features) {
      try {
        const zctaPolygon = feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
        
        // Check if polygons intersect - handle as any to avoid type complexity
        const intersection = turf.intersect(searchPolygon as any, zctaPolygon as any);
        
        if (intersection) {
          const intersectionArea = turf.area(intersection);
          const zctaArea = turf.area(zctaPolygon);
          const intersectionRatio = intersectionArea / zctaArea;

          // Filter by minimum intersection ratio if specified
          if (!includePartial && intersectionRatio < minIntersectionRatio) {
            continue;
          }

          const zipcode = feature.properties?.ZCTA5CE20 || 
                          feature.properties?.ZCTA5CE || 
                          feature.properties?.zipcode;

          if (zipcode) {
            results.push({
              zipcode: zipcode.toString(),
              intersectionArea,
              properties: feature.properties
            });
          }
        }
      } catch (error) {
        // Skip invalid features
        console.warn('Skipping invalid ZCTA feature:', error);
        continue;
      }
    }

    console.log(`✅ Found ${results.length} intersecting ZIP codes`);
    
    // Sort by intersection area (descending)
    return results.sort((a, b) => b.intersectionArea - a.intersectionArea);
  }

  // Get ZIP codes with just the codes (most common use case)
  async getZipcodesFromPolygon(
    polygonPoints: PolygonPoint[],
    options?: { includePartial?: boolean; minIntersectionRatio?: number }
  ): Promise<string[]> {
    const results = await this.findIntersectingZipcodes(polygonPoints, options);
    return results.map(r => r.zipcode);
  }

  // Validate polygon geometry
  validatePolygon(points: PolygonPoint[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    area?: number;
    perimeter?: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (points.length < 3) {
      errors.push('Polygon must have at least 3 points');
      return { isValid: false, errors, warnings };
    }

    try {
      const polygon = this.createGeoJSONPolygon(points);
      
      // Check for self-intersection using Turf
      const kinks = turf.kinks(polygon);
      if (kinks.features.length > 0) {
        errors.push('Polygon edges cannot cross each other');
      }

      // Calculate area and perimeter
      const area = turf.area(polygon) / 1000000; // Convert to km²
      const perimeter = turf.length(turf.polygonToLine(polygon)); // km

      // Area warnings
      if (area > 10000) {
        warnings.push('Very large service area - consider splitting into smaller regions');
      } else if (area < 1) {
        warnings.push('Small service area - may have limited coverage');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        area,
        perimeter
      };
    } catch (error) {
      errors.push('Invalid polygon geometry');
      return { isValid: false, errors, warnings };
    }
  }

  // Get bounding box for a set of points
  getBoundingBox(points: PolygonPoint[]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
  }

  // Calculate centroid of polygon
  getCentroid(points: PolygonPoint[]): PolygonPoint {
    try {
      const polygon = this.createGeoJSONPolygon(points);
      const centroid = turf.centroid(polygon);
      const [lng, lat] = centroid.geometry.coordinates;
      return { lat, lng };
    } catch (error) {
      // Fallback to simple average
      const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
      const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
      return { lat: avgLat, lng: avgLng };
    }
  }
}

// Singleton instance
export const clientSpatialOperations = new ClientSpatialOperations();

// React hook for easier usage
export const useClientSpatialOperations = () => {
  return clientSpatialOperations;
};