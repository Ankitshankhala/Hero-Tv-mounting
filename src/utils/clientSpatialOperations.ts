import * as turf from '@turf/turf';

interface PolygonPoint {
  lat: number;
  lng: number;
}

interface ZipcodeIntersectionResult {
  zipcode: string;
  intersectionArea: number;
  properties: any;
}

interface ZctaSpatialIndex {
  zipcode: string;
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  centroid: [number, number]; // [lng, lat]
  geometryType: 'Polygon' | 'MultiPolygon';
}

export class ClientSpatialOperations {
  private zctaData: GeoJSON.FeatureCollection | null = null;
  private spatialIndex: ZctaSpatialIndex[] | null = null;
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
      
      // Build spatial index for faster lookups
      this.buildSpatialIndex();
    } catch (error) {
      console.error('❌ Failed to load ZCTA data:', error);
      throw error;
    }
  }

  private buildSpatialIndex(): void {
    if (!this.zctaData?.features) return;
    
    console.log('🔧 Building spatial index...');
    const startTime = performance.now();
    this.spatialIndex = [];
    
    let validCount = 0;
    let skippedCount = 0;

    for (const feature of this.zctaData.features) {
      try {
        const zctaFeature = feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
        
        // Extract zipcode
        const zipcode = feature.properties?.ZCTA5CE20 || 
                       feature.properties?.ZCTA5CE || 
                       feature.properties?.zipcode;
        
        if (!zipcode || !zctaFeature.geometry) {
          skippedCount++;
          continue;
        }

        // Calculate bounding box and centroid
        const bbox = turf.bbox(zctaFeature) as [number, number, number, number];
        const centroid = turf.centroid(zctaFeature);
        const geometryType = zctaFeature.geometry.type;

        this.spatialIndex.push({
          zipcode: zipcode.toString(),
          feature: zctaFeature,
          bbox,
          centroid: centroid.geometry.coordinates as [number, number],
          geometryType
        });
        
        validCount++;
      } catch (error) {
        skippedCount++;
        continue;
      }
    }

    const endTime = performance.now();
    console.log(`✅ Built spatial index: ${validCount} valid features, ${skippedCount} skipped, took ${Math.round(endTime - startTime)}ms`);
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
    
    if (!this.spatialIndex) {
      throw new Error('Spatial index not built');
    }

    if (polygonPoints.length < 3) {
      throw new Error('Polygon must have at least 3 points');
    }

    const startTime = performance.now();
    const { includePartial = true, minIntersectionRatio = 0.1 } = options;
    const searchPolygon = this.createGeoJSONPolygon(polygonPoints);
    const results: ZipcodeIntersectionResult[] = [];

    // Stage 1: Calculate search bounds
    const searchBbox = turf.bbox(searchPolygon) as [number, number, number, number];
    const searchCentroid = turf.centroid(searchPolygon);
    
    // Calculate dynamic search radius based on polygon size
    const polygonDiagonal = turf.distance(
      [searchBbox[0], searchBbox[1]], 
      [searchBbox[2], searchBbox[3]], 
      { units: 'miles' }
    );
    const searchRadiusMiles = Math.min(Math.max(polygonDiagonal * 1.5, 10), 75);

    console.log(`🔍 Optimized search: polygon diagonal ${Math.round(polygonDiagonal)}mi, search radius ${Math.round(searchRadiusMiles)}mi`);

    // Stage 2: Bounding box pre-filtering
    const bbox1Time = performance.now();
    const candidates = this.spatialIndex.filter(indexed => {
      // Quick bounding box intersection check
      return !(indexed.bbox[2] < searchBbox[0] || // candidate max lng < search min lng
               indexed.bbox[0] > searchBbox[2] || // candidate min lng > search max lng
               indexed.bbox[3] < searchBbox[1] || // candidate max lat < search min lat
               indexed.bbox[1] > searchBbox[3]);  // candidate min lat > search max lat
    });
    
    const bbox2Time = performance.now();
    console.log(`📦 Bbox filter: ${this.spatialIndex.length} → ${candidates.length} candidates (${Math.round(bbox2Time - bbox1Time)}ms)`);

    // Stage 3: Distance-based filtering for very large polygons
    let distanceFilteredCandidates = candidates;
    if (candidates.length > 1000) {
      distanceFilteredCandidates = candidates.filter(indexed => {
        const distance = turf.distance(
          searchCentroid.geometry.coordinates,
          indexed.centroid,
          { units: 'miles' }
        );
        return distance <= searchRadiusMiles;
      });
      console.log(`🎯 Distance filter: ${candidates.length} → ${distanceFilteredCandidates.length} candidates`);
    }

    // Stage 4: Geometric intersection checks
    const geoTime = performance.now();
    let skippedCount = 0;
    
    for (const indexed of distanceFilteredCandidates) {
      try {
        let isIncluded = false;
        let intersectionArea = 0;

        // Quick centroid check first
        if (turf.booleanPointInPolygon(indexed.centroid, searchPolygon)) {
          isIncluded = true;
          // For centroids inside, use the full ZCTA area as intersection area
          intersectionArea = turf.area(indexed.feature as any);
        } else {
          // Check for geometric intersection
          if (turf.booleanIntersects(indexed.feature, searchPolygon)) {
            isIncluded = true;
            
            // Only calculate intersection area if needed for filtering
            if (!includePartial || minIntersectionRatio > 0) {
              try {
                const intersection = turf.intersect(searchPolygon as any, indexed.feature as any);
                if (intersection) {
                  intersectionArea = turf.area(intersection);
                  
                  // Apply minimum intersection ratio filter
                  if (!includePartial && minIntersectionRatio > 0) {
                    const zctaArea = turf.area(indexed.feature as any);
                    const intersectionRatio = intersectionArea / zctaArea;
                    if (intersectionRatio < minIntersectionRatio) {
                      isIncluded = false;
                    }
                  }
                }
              } catch (intersectError) {
                // If intersection calculation fails, include it anyway for partial intersections
                intersectionArea = turf.area(indexed.feature as any) * 0.1; // Estimate 10% intersection
              }
            } else {
              // For simple inclusion without area requirements, estimate area
              intersectionArea = turf.area(indexed.feature as any) * 0.5; // Estimate 50% intersection
            }
          }
        }

        if (isIncluded) {
          results.push({
            zipcode: indexed.zipcode,
            intersectionArea,
            properties: indexed.feature.properties
          });
        }
      } catch (error) {
        skippedCount++;
        continue;
      }
    }

    const endTime = performance.now();
    console.log(`✅ Found ${results.length} ZIP codes (${skippedCount} skipped) in ${Math.round(endTime - startTime)}ms`);
    
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