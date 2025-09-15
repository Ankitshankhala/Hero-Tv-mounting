# ZCTA Boundary Integration Guide

## Overview

The `zcta2020_web.geojson` file contains ZIP Code Tabulation Areas (ZCTA) boundary data from the 2020 US Census. This guide explains how to integrate this data with your Hero TV application's existing ZIP code validation and service area management systems.

## What is ZCTA Data?

**ZCTA (ZIP Code Tabulation Areas)** are statistical areas created by the US Census Bureau that represent ZIP code service areas. Key characteristics:

- **Accurate Boundaries**: Precise polygon boundaries for each ZIP code
- **Area Information**: Land and water area measurements
- **2020 Census Data**: Most recent official boundary data
- **Web Mercator Projection**: Optimized for web mapping (EPSG:3857)

## File Structure

```json
{
  "type": "FeatureCollection",
  "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::3857" } },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "ZCTA5CE20": "75201",    // 5-digit ZIP code
        "GEOID20": "75201",      // Geographic identifier
        "NAME20": "75201",       // ZIP code name
        "ALAND20": 1234567,      // Land area in square meters
        "AWATER20": 123456       // Water area in square meters
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], [lng, lat], ...]]
      }
    }
  ]
}
```

## Integration Points

### 1. Enhanced ZIP Code Validation

**Current System**: `src/utils/zipcodeValidation.ts`
**Enhancement**: Add boundary data to validation results

```typescript
import { zctaBoundaryService } from '../services/zctaBoundaryService';

export const validateUSZipcodeWithBoundary = async (zipcode: string) => {
  const result = await zctaBoundaryService.getZipcodeWithBoundaryInfo(zipcode);
  return {
    ...result.validationData,
    boundaryData: result.boundaryData
  };
};
```

### 2. Service Coverage Maps

**Current Components**:
- `ServiceCoverageMap.tsx`
- `ServiceCoverageMapEnhanced.tsx`
- `AdminServiceAreaMap.tsx`

**Enhancement**: Add precise boundary visualization

```typescript
import { useZctaBoundaries } from '../hooks/useZctaBoundaries';

// In your map component
const { addBoundaryToMap } = useZctaBoundaries();

// Add boundary when ZIP code is validated
const boundary = await addBoundaryToMap(map, zipcode, {
  color: hasService ? '#10b981' : '#ef4444',
  fillOpacity: 0.2
});
```

### 3. Worker Service Area Management

**Current System**: Worker-drawn service areas
**Enhancement**: Show ZIP code boundaries for reference

```typescript
// In AdminServiceAreaMap.tsx or ServiceAreaMap.tsx
const showZipBoundariesForReference = async (zipcodes: string[]) => {
  for (const zipcode of zipcodes) {
    await addBoundaryToMap(map, zipcode, {
      color: '#gray',
      weight: 1,
      fillOpacity: 0.05,
      interactive: false // Reference only
    });
  }
};
```

### 4. Enhanced ZIP Code Input Components

**Current Components**:
- `ZipcodeInput.tsx`
- `EnhancedZipcodeInput.tsx`

**Enhancement**: Show boundary preview on hover/focus

```typescript
const ZipcodeInputWithBoundary = ({ onZipcodeChange }) => {
  const [showPreview, setShowPreview] = useState(false);
  const { getZipcodeBoundary } = useZctaBoundaries();

  const handleZipcodeChange = async (zipcode: string) => {
    onZipcodeChange(zipcode);
    
    if (zipcode.length === 5) {
      const boundary = await getZipcodeBoundary(zipcode);
      if (boundary) {
        setShowPreview(true);
        // Show mini map or boundary info
      }
    }
  };

  // ... rest of component
};
```

## Usage Examples

### Basic Boundary Lookup

```typescript
import { zctaBoundaryService } from '../services/zctaBoundaryService';

// Get boundary data for a ZIP code
const boundaryData = await zctaBoundaryService.getZipcodeBoundary('75201');

if (boundaryData) {
  console.log(`ZIP ${boundaryData.zipcode}`);
  console.log(`Area: ${boundaryData.area.totalAreaSqMiles.toFixed(2)} sq mi`);
  console.log(`Bounds:`, boundaryData.bounds);
}
```

### Map Integration

```typescript
import { useZctaBoundaries } from '../hooks/useZctaBoundaries';

const MyMapComponent = () => {
  const { addBoundaryToMap } = useZctaBoundaries();
  
  const showZipcodeBoundary = async (zipcode: string) => {
    const layer = await addBoundaryToMap(mapRef.current, zipcode, {
      color: '#3b82f6',
      weight: 2,
      fillOpacity: 0.1
    });
    
    if (layer) {
      layer.bindPopup(`ZIP Code: ${zipcode}`);
    }
  };
  
  // ... rest of component
};
```

### Service Coverage Analysis

```typescript
// Find all ZIP codes within a radius
const nearbyZipcodes = await zctaBoundaryService.findNearbyZipcodes('75201', 10);

// Analyze service coverage for nearby areas
const coverageAnalysis = await Promise.all(
  nearbyZipcodes.map(async (zipcode) => {
    const coverage = await getServiceCoverageInfo(zipcode);
    return { zipcode, ...coverage };
  })
);
```

## Performance Considerations

### 1. File Size Management
- **Current Size**: ~33,799 lines (large file)
- **Loading Strategy**: Lazy load on first use
- **Caching**: Cache loaded data in memory
- **Compression**: Serve gzipped from server

### 2. Optimization Strategies

```typescript
// Implement progressive loading for large areas
const loadBoundariesForRegion = async (bounds: LatLngBounds) => {
  // Only load boundaries visible in current map view
  const visibleFeatures = allFeatures.filter(feature => 
    boundsContainFeature(bounds, feature)
  );
  return visibleFeatures;
};

// Use web workers for heavy processing
const processBoundaryData = (data: GeoJSON.FeatureCollection) => {
  const worker = new Worker('/boundary-processor.js');
  worker.postMessage(data);
  return new Promise(resolve => {
    worker.onmessage = (e) => resolve(e.data);
  });
};
```

### 3. Memory Management

```typescript
// Implement LRU cache for boundary data
class BoundaryCache {
  private cache = new Map();
  private maxSize = 100;
  
  get(zipcode: string) {
    if (this.cache.has(zipcode)) {
      // Move to end (most recently used)
      const value = this.cache.get(zipcode);
      this.cache.delete(zipcode);
      this.cache.set(zipcode, value);
      return value;
    }
    return null;
  }
  
  set(zipcode: string, data: any) {
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(zipcode, data);
  }
}
```

## Testing Integration

### 1. Unit Tests

```typescript
// Test boundary service
describe('ZctaBoundaryService', () => {
  it('should load boundary data for valid ZIP code', async () => {
    const boundary = await zctaBoundaryService.getZipcodeBoundary('75201');
    expect(boundary).toBeTruthy();
    expect(boundary.zipcode).toBe('75201');
    expect(boundary.area.totalAreaSqMiles).toBeGreaterThan(0);
  });
  
  it('should return null for invalid ZIP code', async () => {
    const boundary = await zctaBoundaryService.getZipcodeBoundary('99999');
    expect(boundary).toBeNull();
  });
});
```

### 2. Integration Tests

```typescript
// Test map integration
describe('Map Boundary Integration', () => {
  it('should add boundary layer to map', async () => {
    const { addBoundaryToMap } = useZctaBoundaries();
    const layer = await addBoundaryToMap(mockMap, '75201');
    
    expect(layer).toBeTruthy();
    expect(mockMap.hasLayer(layer)).toBe(true);
  });
});
```

## Deployment Considerations

### 1. File Serving
- **Location**: `/public/zcta2020_web.geojson`
- **Compression**: Enable gzip compression
- **CDN**: Consider serving from CDN for better performance
- **Caching**: Set appropriate cache headers

### 2. Error Handling

```typescript
// Graceful degradation when boundary data unavailable
const getBoundaryWithFallback = async (zipcode: string) => {
  try {
    return await zctaBoundaryService.getZipcodeBoundary(zipcode);
  } catch (error) {
    console.warn('Boundary data unavailable, using basic validation');
    return await validateUSZipcode(zipcode);
  }
};
```

## Future Enhancements

### 1. Advanced Spatial Queries
- Point-in-polygon queries for address validation
- Intersection analysis for service area optimization
- Distance calculations between ZIP codes

### 2. Data Updates
- Automated updates when new ZCTA data is released
- Version management for boundary data
- Migration strategies for data updates

### 3. Additional Features
- Population density overlay
- Demographic data integration
- Traffic pattern analysis for service optimization

## Conclusion

The ZCTA boundary data provides a powerful foundation for enhancing your ZIP code validation and service area management. By integrating this data thoughtfully with your existing systems, you can provide more accurate service coverage information and better visual representations of your service areas.

Key benefits:
- **Accurate Boundaries**: Precise ZIP code boundaries instead of approximate circles
- **Enhanced UX**: Visual feedback for users entering ZIP codes
- **Better Planning**: More accurate service area planning for workers
- **Data-Driven Decisions**: Area-based analytics for business intelligence
