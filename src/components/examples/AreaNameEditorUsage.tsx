import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AreaNameEditor from '@/components/shared/AreaNameEditor';
import { bindEditablePopup, createEditablePopupContent } from '@/components/shared/EditableAreaPopup';
import { useAreaNameEditor, useBulkAreaNameEditor } from '@/hooks/useAreaNameEditor';
import EnhancedServiceAreaMap from '@/components/admin/EnhancedServiceAreaMap';
import { Code, MapPin, Edit2, Lightbulb } from 'lucide-react';

// Mock data for examples
const mockServiceArea = {
  id: '1',
  area_name: 'Downtown Dallas',
  polygon_coordinates: [
    { lat: 32.7767, lng: -96.7970 },
    { lat: 32.7800, lng: -96.7900 },
    { lat: 32.7750, lng: -96.7850 },
    { lat: 32.7720, lng: -96.7920 }
  ],
  is_active: true,
  created_at: '2024-01-15T10:00:00Z',
  worker_id: 'worker-1'
};

const mockWorker = {
  id: 'worker-1',
  name: 'John Smith',
  service_areas: [mockServiceArea]
};

/**
 * Comprehensive usage examples for the Area Name Editor functionality
 */
export const AreaNameEditorUsage: React.FC = () => {
  const [demoArea, setDemoArea] = useState(mockServiceArea);
  
  // Example of using the hook
  const { updateAreaName, validateAreaName } = useAreaNameEditor({
    adminMode: true,
    onSuccess: (areaId, newName) => {
      console.log(`Successfully renamed area ${areaId} to ${newName}`);
      setDemoArea(prev => ({ ...prev, area_name: newName }));
    }
  });

  const handleMockUpdate = async (areaId: string, newName: string) => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setDemoArea(prev => ({ ...prev, area_name: newName }));
    return true;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Area Name Editor - Usage Guide</h1>
        <p className="text-muted-foreground">
          Comprehensive examples of editing service area names on maps
        </p>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic Usage</TabsTrigger>
          <TabsTrigger value="inline">Inline Editor</TabsTrigger>
          <TabsTrigger value="popup">Map Popups</TabsTrigger>
          <TabsTrigger value="hooks">Hooks</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        {/* Basic Usage */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                Basic Area Name Editor
              </CardTitle>
              <CardDescription>
                Simple inline editing component for service area names
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <AreaNameEditor
                  area={demoArea}
                  onNameUpdate={handleMockUpdate}
                  trigger="inline"
                />
              </div>
              
              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Code Example:</h4>
                <pre className="text-sm overflow-x-auto">
{`import AreaNameEditor from '@/components/shared/AreaNameEditor';

<AreaNameEditor
  area={serviceArea}
  onNameUpdate={updateAreaName}
  trigger="inline"
/>`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inline Editor */}
        <TabsContent value="inline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inline vs Modal Triggers</CardTitle>
              <CardDescription>
                Choose between inline editing or modal dialog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Inline Editor (Default)</h4>
                <div className="p-3 border rounded">
                  <AreaNameEditor
                    area={demoArea}
                    onNameUpdate={handleMockUpdate}
                    trigger="inline"
                  />
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Modal Editor</h4>
                <div className="p-3 border rounded flex items-center gap-2">
                  <span className="text-sm">{demoArea.area_name}</span>
                  <AreaNameEditor
                    area={demoArea}
                    onNameUpdate={handleMockUpdate}
                    trigger="modal"
                  />
                </div>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Usage:</h4>
                <pre className="text-sm overflow-x-auto">
{`// Inline editing (default)
<AreaNameEditor area={area} onNameUpdate={updateFn} />

// Modal dialog
<AreaNameEditor 
  area={area} 
  onNameUpdate={updateFn} 
  trigger="modal" 
/>`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Map Popups */}
        <TabsContent value="popup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Editable Map Popups
              </CardTitle>
              <CardDescription>
                Interactive popups with name editing capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Integration with Leaflet:</h4>
                <pre className="text-sm overflow-x-auto">
{`import { bindEditablePopup } from '@/components/shared/EditableAreaPopup';
import * as L from 'leaflet';

// Create polygon
const polygon = L.polygon(coordinates, options);

// Bind editable popup
bindEditablePopup(
  polygon,
  serviceArea,
  worker,
  updateAreaName,
  zipCodeCount
);

polygon.addTo(map);`}
                </pre>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Pro Tip</h4>
                    <p className="text-blue-800 text-sm mt-1">
                      The editable popup automatically handles React component rendering 
                      inside Leaflet popups and cleans up when closed.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hooks */}
        <TabsContent value="hooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                useAreaNameEditor Hook
              </CardTitle>
              <CardDescription>
                Powerful hook for managing area name updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Basic Hook Usage:</h4>
                <pre className="text-sm overflow-x-auto">
{`import { useAreaNameEditor } from '@/hooks/useAreaNameEditor';

const { 
  updateAreaName, 
  validateAreaName, 
  checkNameExists 
} = useAreaNameEditor({
  adminMode: true, // or false for worker mode
  workerId: 'worker-id', // required for worker mode
  onSuccess: (areaId, newName) => {
    console.log(\`Renamed area \${areaId} to \${newName}\`);
  },
  onError: (error) => {
    console.error('Update failed:', error);
  }
});

// Update an area name
const success = await updateAreaName('area-id', 'New Name');

// Validate a name
const { isValid, error } = validateAreaName('Test Name');`}
                </pre>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Bulk Updates:</h4>
                <pre className="text-sm overflow-x-auto">
{`import { useBulkAreaNameEditor } from '@/hooks/useAreaNameEditor';

const { updateMultipleAreaNames } = useBulkAreaNameEditor({
  adminMode: true
});

const results = await updateMultipleAreaNames([
  { areaId: 'area-1', newName: 'North District' },
  { areaId: 'area-2', newName: 'South District' }
]);

console.log(\`Success: \${results.success}, Failed: \${results.failed}\`);`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Example */}
        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Integration Example</CardTitle>
              <CardDescription>
                Full example with map, popups, and editing functionality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                <EnhancedServiceAreaMap
                  workers={[mockWorker]}
                  adminMode={true}
                  showInactiveAreas={true}
                  onAreaNameUpdate={(areaId, newName) => {
                    console.log(`Area ${areaId} renamed to ${newName}`);
                  }}
                />
              </div>
              
              <div className="mt-4 bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Integration Steps:</h4>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Import the necessary components and hooks</li>
                  <li>Set up the map with Leaflet</li>
                  <li>Use bindEditablePopup for polygon interactions</li>
                  <li>Integrate with existing service area hooks</li>
                  <li>Handle success/error callbacks</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Features Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Key Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">✅ Inline Editing</h4>
              <p className="text-sm text-muted-foreground">
                Edit area names directly in lists and tables
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">✅ Modal Dialog</h4>
              <p className="text-sm text-muted-foreground">
                Full-featured modal for detailed editing
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">✅ Map Integration</h4>
              <p className="text-sm text-muted-foreground">
                Interactive popups on map polygons
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">✅ Validation</h4>
              <p className="text-sm text-muted-foreground">
                Built-in name validation and error handling
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">✅ Bulk Updates</h4>
              <p className="text-sm text-muted-foreground">
                Update multiple area names at once
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">✅ Audit Logging</h4>
              <p className="text-sm text-muted-foreground">
                Automatic audit trail for all changes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AreaNameEditorUsage;
