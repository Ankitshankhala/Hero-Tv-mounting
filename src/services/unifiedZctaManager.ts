import * as turf from '@turf/turf';

interface ZctaCacheEntry {
  data: GeoJSON.FeatureCollection;
  loadedAt: number;
  spatialIndex?: ZctaSpatialIndex[];
}

interface ZctaSpatialIndex {
  zipcode: string;
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox: [number, number, number, number];
  centroid: [number, number];
}

interface ZctaLoadProgress {
  phase: 'downloading' | 'processing' | 'indexing' | 'complete';
  progress: number;
  message: string;
}

type ProgressCallback = (progress: ZctaLoadProgress) => void;

class UnifiedZctaManager {
  private static instance: UnifiedZctaManager;
  private cache: ZctaCacheEntry | null = null;
  private loadingPromise: Promise<GeoJSON.FeatureCollection> | null = null;
  private progressCallbacks: Set<ProgressCallback> = new Set();

  static getInstance(): UnifiedZctaManager {
    if (!UnifiedZctaManager.instance) {
      UnifiedZctaManager.instance = new UnifiedZctaManager();
    }
    return UnifiedZctaManager.instance;
  }

  private notifyProgress(progress: ZctaLoadProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  addProgressListener(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  async loadZctaData(forceReload = false): Promise<GeoJSON.FeatureCollection> {
    // Return cached data if available and not forcing reload
    if (this.cache && !forceReload) {
      this.notifyProgress({
        phase: 'complete',
        progress: 100,
        message: 'Using cached ZCTA data'
      });
      return this.cache.data;
    }

    // Return existing loading promise if in progress
    if (this.loadingPromise && !forceReload) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.fetchAndProcessZctaData();
    return this.loadingPromise;
  }

  private async fetchAndProcessZctaData(): Promise<GeoJSON.FeatureCollection> {
    try {
      // Phase 1: Download
      this.notifyProgress({
        phase: 'downloading',
        progress: 0,
        message: 'Downloading ZCTA boundary data...'
      });

      const response = await fetch('/zcta2020_web.geojson', { 
        cache: 'force-cache' // Use browser cache when possible
      });

      if (!response.ok) {
        throw new Error(`Failed to load ZCTA data: ${response.statusText}`);
      }

      this.notifyProgress({
        phase: 'downloading',
        progress: 50,
        message: 'Processing GeoJSON data...'
      });

      const data = await response.json() as GeoJSON.FeatureCollection;

      // Phase 2: Processing
      this.notifyProgress({
        phase: 'processing',
        progress: 0,
        message: `Processing ${data.features.length} ZCTA features...`
      });

      // Validate and clean data
      const cleanedData = this.validateAndCleanData(data);

      // Phase 3: Build spatial index
      this.notifyProgress({
        phase: 'indexing',
        progress: 0,
        message: 'Building spatial index for faster lookups...'
      });

      const spatialIndex = await this.buildSpatialIndex(cleanedData);

      // Cache the results
      this.cache = {
        data: cleanedData,
        loadedAt: Date.now(),
        spatialIndex
      };

      this.notifyProgress({
        phase: 'complete',
        progress: 100,
        message: `Ready: ${cleanedData.features.length} ZIP codes indexed`
      });

      this.loadingPromise = null;
      return cleanedData;

    } catch (error) {
      this.loadingPromise = null;
      throw error;
    }
  }

  private validateAndCleanData(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
    let validCount = 0;
    let cleanedCount = 0;

    const cleanedFeatures = data.features.filter(feature => {
      try {
        const zipcode = feature.properties?.ZCTA5CE20 || 
                       feature.properties?.ZCTA5CE || 
                       feature.properties?.zipcode;

        if (!zipcode || !feature.geometry) {
          return false;
        }

        // Convert Web Mercator to WGS84 if needed
        const convertedFeature = this.convertWebMercatorToWGS84(feature);
        if (convertedFeature) {
          Object.assign(feature, convertedFeature);
          cleanedCount++;
        }

        validCount++;
        return true;
      } catch (error) {
        console.warn(`Skipping invalid ZCTA feature:`, error);
        return false;
      }
    });

    console.log(`✅ ZCTA validation: ${validCount} valid, ${cleanedCount} coordinates converted`);

    return {
      ...data,
      features: cleanedFeatures
    };
  }

  private convertWebMercatorToWGS84(feature: any): any | null {
    try {
      const convertCoordinates = (coords: number[][]): number[][] => {
        const R = 6378137.0; // Web Mercator sphere radius
        return coords.map(coord => {
          const [x, y] = coord;
          if (Math.abs(x) > 180 || Math.abs(y) > 90) {
            const lng = (x * 180) / (Math.PI * R);
            const lat = (Math.atan(Math.sinh(y / R)) * 180) / Math.PI;
            return [lng, lat];
          }
          return [x, y];
        });
      };

      if (feature.geometry.type === 'Polygon') {
        const convertedCoords = feature.geometry.coordinates.map((ring: number[][]) => 
          convertCoordinates(ring)
        );
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: convertedCoords
          }
        };
      } else if (feature.geometry.type === 'MultiPolygon') {
        const convertedCoords = feature.geometry.coordinates.map((polygon: number[][][]) => 
          polygon.map((ring: number[][]) => convertCoordinates(ring))
        );
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: convertedCoords
          }
        };
      }

      return feature;
    } catch (error) {
      return null;
    }
  }

  private async buildSpatialIndex(data: GeoJSON.FeatureCollection): Promise<ZctaSpatialIndex[]> {
    const index: ZctaSpatialIndex[] = [];
    const total = data.features.length;

    for (let i = 0; i < data.features.length; i++) {
      const feature = data.features[i];
      
      try {
        const zipcode = feature.properties?.ZCTA5CE20?.toString() || '';
        if (!zipcode) continue;

        const bbox = turf.bbox(feature) as [number, number, number, number];
        const centroid = turf.centroid(feature);

        index.push({
          zipcode,
          feature: feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
          bbox,
          centroid: centroid.geometry.coordinates as [number, number]
        });

        // Update progress every 1000 features
        if (i % 1000 === 0) {
          this.notifyProgress({
            phase: 'indexing',
            progress: (i / total) * 100,
            message: `Indexing: ${i}/${total} features processed`
          });
        }
      } catch (error) {
        console.warn(`Failed to index feature ${i}:`, error);
      }
    }

    return index;
  }

  getSpatialIndex(): ZctaSpatialIndex[] | null {
    return this.cache?.spatialIndex || null;
  }

  findZipcodesInBounds(bounds: L.LatLngBounds): string[] {
    const index = this.getSpatialIndex();
    if (!index) return [];

    const searchBbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(), 
      bounds.getEast(),
      bounds.getNorth()
    ];

    return index
      .filter(entry => {
        const [minLng, minLat, maxLng, maxLat] = entry.bbox;
        return !(maxLng < searchBbox[0] || minLng > searchBbox[2] || 
                maxLat < searchBbox[1] || minLat > searchBbox[3]);
      })
      .map(entry => entry.zipcode);
  }

  getZipcodeBoundary(zipcode: string): GeoJSON.Feature | null {
    const index = this.getSpatialIndex();
    if (!index) return null;

    const cleanZipcode = zipcode.replace(/[^\d]/g, '').substring(0, 5);
    const entry = index.find(entry => entry.zipcode === cleanZipcode);
    return entry?.feature || null;
  }

  isReady(): boolean {
    return this.cache !== null && this.cache.spatialIndex !== null;
  }

  getCacheAge(): number {
    return this.cache ? Date.now() - this.cache.loadedAt : 0;
  }

  clearCache(): void {
    this.cache = null;
    this.loadingPromise = null;
  }
}

export const unifiedZctaManager = UnifiedZctaManager.getInstance();
export type { ZctaLoadProgress, ZctaSpatialIndex };