import { validateUSZipcode } from '../utils/zipcodeValidation';

interface ZctaProperties {
  ZCTA5CE20: string;
  GEOID20: string;
  NAME20: string;
  ALAND20: number; // Land area in square meters
  AWATER20: number; // Water area in square meters
}

interface ZctaBoundaryData {
  zipcode: string;
  properties: ZctaProperties;
  geometry: GeoJSON.Geometry;
  area: {
    landAreaSqMiles: number;
    waterAreaSqMiles: number;
    totalAreaSqMiles: number;
  };
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

class ZctaBoundaryService {
  private static instance: ZctaBoundaryService;
  private boundaryData: GeoJSON.FeatureCollection | null = null;
  private loadingPromise: Promise<GeoJSON.FeatureCollection> | null = null;

  private constructor() {}

  static getInstance(): ZctaBoundaryService {
    if (!ZctaBoundaryService.instance) {
      ZctaBoundaryService.instance = new ZctaBoundaryService();
    }
    return ZctaBoundaryService.instance;
  }

  private async loadBoundaryData(): Promise<GeoJSON.FeatureCollection> {
    if (this.boundaryData) {
      return this.boundaryData;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = fetch('/zcta2020_web.geojson')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load ZCTA boundary data: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        this.boundaryData = data;
        this.loadingPromise = null;
        return data;
      })
      .catch(error => {
        this.loadingPromise = null;
        throw error;
      });

    return this.loadingPromise;
  }

  private calculateBounds(coordinates: number[][][]): { north: number; south: number; east: number; west: number } {
    let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
    
    coordinates.forEach(ring => {
      ring.forEach(([lng, lat]) => {
        north = Math.max(north, lat);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        west = Math.min(west, lng);
      });
    });

    return { north, south, east, west };
  }

  private convertAreaToSquareMiles(squareMeters: number): number {
    // 1 square meter = 3.861e-7 square miles
    return squareMeters * 3.861e-7;
  }

  async getZipcodeBoundary(zipcode: string): Promise<ZctaBoundaryData | null> {
    try {
      const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
      const data = await this.loadBoundaryData();
      
      const feature = data.features.find((f: any) => 
        f.properties.ZCTA5CE20 === cleanZipcode
      );

      if (!feature) {
        return null;
      }

      const props = feature.properties as ZctaProperties;
      const landAreaSqMiles = this.convertAreaToSquareMiles(props.ALAND20);
      const waterAreaSqMiles = this.convertAreaToSquareMiles(props.AWATER20);

      let bounds;
      if (feature.geometry.type === 'Polygon') {
        bounds = this.calculateBounds(feature.geometry.coordinates);
      } else if (feature.geometry.type === 'MultiPolygon') {
        // For MultiPolygon, calculate bounds from all polygons
        const allCoords = feature.geometry.coordinates.flat();
        bounds = this.calculateBounds(allCoords);
      }

      return {
        zipcode: cleanZipcode,
        properties: props,
        geometry: feature.geometry,
        area: {
          landAreaSqMiles,
          waterAreaSqMiles,
          totalAreaSqMiles: landAreaSqMiles + waterAreaSqMiles
        },
        bounds
      };
    } catch (error) {
      console.error('Error getting zipcode boundary:', error);
      return null;
    }
  }

  async getZipcodeWithBoundaryInfo(zipcode: string): Promise<{
    validationData: any;
    boundaryData: ZctaBoundaryData | null;
  }> {
    try {
      // Run validation and boundary lookup in parallel
      const [validationData, boundaryData] = await Promise.all([
        validateUSZipcode(zipcode),
        this.getZipcodeBoundary(zipcode)
      ]);

      return {
        validationData,
        boundaryData
      };
    } catch (error) {
      console.error('Error getting zipcode with boundary info:', error);
      return {
        validationData: null,
        boundaryData: null
      };
    }
  }

  async findNearbyZipcodes(targetZipcode: string, radiusMiles: number = 10): Promise<string[]> {
    try {
      const targetBoundary = await this.getZipcodeBoundary(targetZipcode);
      if (!targetBoundary || !targetBoundary.bounds) {
        return [];
      }

      const data = await this.loadBoundaryData();
      const nearbyZipcodes: string[] = [];

      // Simple bounding box approach for performance
      // In a production app, you might want to use more sophisticated spatial queries
      const searchBounds = {
        north: targetBoundary.bounds.north + (radiusMiles * 0.0145), // Rough degrees per mile
        south: targetBoundary.bounds.south - (radiusMiles * 0.0145),
        east: targetBoundary.bounds.east + (radiusMiles * 0.0145),
        west: targetBoundary.bounds.west - (radiusMiles * 0.0145)
      };

      data.features.forEach((feature: any) => {
        const zipcode = feature.properties.ZCTA5CE20;
        if (zipcode === targetZipcode) return;

        // Simple bounds check
        if (feature.geometry.type === 'Polygon') {
          const bounds = this.calculateBounds(feature.geometry.coordinates);
          if (bounds.north >= searchBounds.south && 
              bounds.south <= searchBounds.north &&
              bounds.east >= searchBounds.west && 
              bounds.west <= searchBounds.east) {
            nearbyZipcodes.push(zipcode);
          }
        }
      });

      return nearbyZipcodes.slice(0, 50); // Limit results
    } catch (error) {
      console.error('Error finding nearby zipcodes:', error);
      return [];
    }
  }

  async getZipcodeCoverage(): Promise<{
    totalZipcodes: number;
    stateBreakdown: { [state: string]: number };
  }> {
    try {
      const data = await this.loadBoundaryData();
      const stateBreakdown: { [state: string]: number } = {};
      
      // Note: ZCTA data doesn't include state info directly
      // You might need to cross-reference with your existing ZIP data
      data.features.forEach((feature: any) => {
        // This would require additional logic to determine state from coordinates
        // For now, just count total
      });

      return {
        totalZipcodes: data.features.length,
        stateBreakdown
      };
    } catch (error) {
      console.error('Error getting zipcode coverage:', error);
      return {
        totalZipcodes: 0,
        stateBreakdown: {}
      };
    }
  }
}

export const zctaBoundaryService = ZctaBoundaryService.getInstance();
export type { ZctaBoundaryData, ZctaProperties };
