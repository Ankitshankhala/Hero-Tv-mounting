import React, { useState, useEffect } from 'react';
import { ServiceCoverageMapWithBoundaries } from '../components/ServiceCoverageMapWithBoundaries';
import { useZctaBoundaries } from '../hooks/useZctaBoundaries';
import { zctaBoundaryService } from '../services/zctaBoundaryService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

// Example 1: Enhanced Service Coverage Map
export const EnhancedServiceCoverageExample: React.FC = () => {
  const handleBookingRequest = (zipcode: string) => {
    console.log(`Booking requested for ZIP code: ${zipcode}`);
    // Navigate to booking flow or open booking modal
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Enhanced Service Coverage Map</h2>
      <ServiceCoverageMapWithBoundaries 
        onBookingRequested={handleBookingRequest}
        className="w-full"
        initialZipcode="75201" // Dallas example
      />
    </div>
  );
};

// Example 2: ZIP Code Boundary Information Panel
export const ZipcodeBoundaryInfoExample: React.FC = () => {
  const [zipcode, setZipcode] = useState('');
  const [boundaryInfo, setBoundaryInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!zipcode) return;
    
    setLoading(true);
    try {
      const result = await zctaBoundaryService.getZipcodeWithBoundaryInfo(zipcode);
      setBoundaryInfo(result);
    } catch (error) {
      console.error('Error looking up zipcode:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">ZIP Code Boundary Information</h2>
      
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Enter ZIP code"
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={handleLookup} disabled={loading}>
          {loading ? 'Looking up...' : 'Lookup'}
        </Button>
      </div>

      {boundaryInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Validation Info */}
          <Card>
            <CardHeader>
              <CardTitle>Validation Info</CardTitle>
            </CardHeader>
            <CardContent>
              {boundaryInfo.validationData ? (
                <div className="space-y-2">
                  <div><strong>City:</strong> {boundaryInfo.validationData.city}</div>
                  <div><strong>State:</strong> {boundaryInfo.validationData.state}</div>
                  <div><strong>Coordinates:</strong> {boundaryInfo.validationData.latitude?.toFixed(4)}, {boundaryInfo.validationData.longitude?.toFixed(4)}</div>
                </div>
              ) : (
                <p className="text-red-600">ZIP code not found in validation system</p>
              )}
            </CardContent>
          </Card>

          {/* Boundary Info */}
          <Card>
            <CardHeader>
              <CardTitle>Boundary Information</CardTitle>
            </CardHeader>
            <CardContent>
              {boundaryInfo.boundaryData ? (
                <div className="space-y-2">
                  <div><strong>ZCTA Code:</strong> {boundaryInfo.boundaryData.properties.ZCTA5CE20}</div>
                  <div><strong>Land Area:</strong> {boundaryInfo.boundaryData.area.landAreaSqMiles.toFixed(2)} sq mi</div>
                  <div><strong>Water Area:</strong> {boundaryInfo.boundaryData.area.waterAreaSqMiles.toFixed(2)} sq mi</div>
                  <div><strong>Total Area:</strong> {boundaryInfo.boundaryData.area.totalAreaSqMiles.toFixed(2)} sq mi</div>
                  {boundaryInfo.boundaryData.bounds && (
                    <div className="mt-2">
                      <strong>Bounds:</strong>
                      <div className="text-sm text-gray-600">
                        N: {boundaryInfo.boundaryData.bounds.north.toFixed(4)}, 
                        S: {boundaryInfo.boundaryData.bounds.south.toFixed(4)}<br/>
                        E: {boundaryInfo.boundaryData.bounds.east.toFixed(4)}, 
                        W: {boundaryInfo.boundaryData.bounds.west.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-red-600">No boundary data found</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Example 3: Nearby ZIP Codes Finder
export const NearbyZipcodesExample: React.FC = () => {
  const [zipcode, setZipcode] = useState('');
  const [radius, setRadius] = useState(10);
  const [nearbyZipcodes, setNearbyZipcodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFindNearby = async () => {
    if (!zipcode) return;
    
    setLoading(true);
    try {
      const nearby = await zctaBoundaryService.findNearbyZipcodes(zipcode, radius);
      setNearbyZipcodes(nearby);
    } catch (error) {
      console.error('Error finding nearby zipcodes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Find Nearby ZIP Codes</h2>
      
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="Enter ZIP code"
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value)}
          className="max-w-xs"
        />
        <Input
          type="number"
          placeholder="Radius (miles)"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="max-w-xs"
          min="1"
          max="50"
        />
        <Button onClick={handleFindNearby} disabled={loading}>
          {loading ? 'Searching...' : 'Find Nearby'}
        </Button>
      </div>

      {nearbyZipcodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nearby ZIP Codes ({nearbyZipcodes.length} found)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {nearbyZipcodes.map(zip => (
                <Badge key={zip} variant="secondary" className="cursor-pointer hover:bg-gray-200">
                  {zip}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Example 4: Integration with Existing Service Area Management
export const ServiceAreaBoundaryIntegration: React.FC<{ workerId?: string }> = ({ workerId }) => {
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const { addBoundaryToMap } = useZctaBoundaries();

  // This would integrate with your existing useWorkerServiceAreas hook
  useEffect(() => {
    if (workerId) {
      // Load worker's service areas
      // This is pseudocode - you'd use your existing hooks
      // const { serviceZipcodes } = useWorkerServiceAreas(workerId);
      // setServiceAreas(serviceZipcodes);
    }
  }, [workerId]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Service Area Boundaries</h2>
      <p className="text-gray-600">
        This example shows how to integrate ZCTA boundaries with your existing 
        service area management system.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle>Integration Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>• <strong>ServiceAreaMap.tsx:</strong> Add boundary visualization</div>
            <div>• <strong>AdminServiceAreaMap.tsx:</strong> Show precise coverage areas</div>
            <div>• <strong>EnhancedWorkerServiceAreasMap.tsx:</strong> Overlay boundaries on worker areas</div>
            <div>• <strong>ZipcodeInput components:</strong> Show boundary preview on hover</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main example component
export const ZctaBoundaryExamples: React.FC = () => {
  const [activeExample, setActiveExample] = useState<string>('map');

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ZCTA Boundary Usage Examples</h1>
      
      {/* Navigation */}
      <div className="flex space-x-2 mb-6">
        <Button 
          variant={activeExample === 'map' ? 'default' : 'outline'}
          onClick={() => setActiveExample('map')}
        >
          Enhanced Map
        </Button>
        <Button 
          variant={activeExample === 'info' ? 'default' : 'outline'}
          onClick={() => setActiveExample('info')}
        >
          Boundary Info
        </Button>
        <Button 
          variant={activeExample === 'nearby' ? 'default' : 'outline'}
          onClick={() => setActiveExample('nearby')}
        >
          Nearby ZIP Codes
        </Button>
        <Button 
          variant={activeExample === 'integration' ? 'default' : 'outline'}
          onClick={() => setActiveExample('integration')}
        >
          Integration
        </Button>
      </div>

      {/* Content */}
      <div>
        {activeExample === 'map' && <EnhancedServiceCoverageExample />}
        {activeExample === 'info' && <ZipcodeBoundaryInfoExample />}
        {activeExample === 'nearby' && <NearbyZipcodesExample />}
        {activeExample === 'integration' && <ServiceAreaBoundaryIntegration />}
      </div>
    </div>
  );
};
