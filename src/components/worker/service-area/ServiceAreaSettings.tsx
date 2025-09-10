import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MapPin, 
  Hash, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff,
  Search,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkerServiceAreas } from '@/hooks/useWorkerServiceAreas';
import ServiceAreaMap from './ServiceAreaMap';
import { ZipCodeTester } from './ZipCodeTester';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ServiceAreaSettings: React.FC = () => {
  const { user } = useAuth();
  const { 
    serviceAreas, 
    serviceZipcodes, 
    loading, 
    fetchServiceAreas,
    addZipCodes,
    getActiveZipcodes,
    toggleServiceAreaStatus,
    deleteServiceArea
  } = useWorkerServiceAreas(user?.id);
  
  const [newZipcodes, setNewZipcodes] = useState<string>('');
  const [singleZipcode, setSingleZipcode] = useState('');
  const [zipSearchTerm, setZipSearchTerm] = useState('');
  const [savingZips, setSavingZips] = useState(false);
  const [savingSingle, setSavingSingle] = useState(false);
  const [activeTab, setActiveTab] = useState('areas');
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchServiceAreas();
    }
  }, [user?.id, fetchServiceAreas]);

  // Get unique zipcodes for the ZIP tab
  const allZipcodes = Array.from(new Set(
    serviceZipcodes.map(zip => zip.zipcode)
  )).sort();

  // Filter zipcodes by search term
  const filteredZipcodes = allZipcodes.filter(zip => 
    zip.includes(zipSearchTerm)
  );

  const activeZipcodes = getActiveZipcodes();

  const handleAddZipcodes = async () => {
    if (!newZipcodes.trim() || !user?.id) return;

    setSavingZips(true);
    try {
      // Parse the input (comma or space separated)
      const zipList = newZipcodes
        .split(/[,\s]+/)
        .map(zip => zip.trim())
        .filter(zip => /^\d{5}$/.test(zip)); // Only 5-digit ZIP codes

      if (zipList.length === 0) {
        throw new Error('Please enter valid 5-digit ZIP codes');
      }

      // Use the new unified addZipCodes function
      await addZipCodes(zipList, `ZIP Codes Area (${zipList.length} ZIPs)`, 'append');
      setNewZipcodes('');

    } catch (error) {
      console.error('Error adding ZIP codes:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add ZIP codes",
        variant: "destructive",
      });
    } finally {
      setSavingZips(false);
    }
  };

  const handleAddSingleZip = async () => {
    if (!singleZipcode.trim() || !/^\d{5}$/.test(singleZipcode) || !user?.id) {
      toast({
        title: 'Invalid ZIP Code',
        description: 'Please enter a valid 5-digit ZIP code',
        variant: 'destructive',
      });
      return;
    }

    setSavingSingle(true);
    try {
      const zip = singleZipcode.trim();
      await addZipCodes([zip], `ZIP Code ${zip}`, 'append');
      setSingleZipcode('');
    } catch (error) {
      console.error('Error adding ZIP code:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add ZIP code',
        variant: 'destructive',
      });
    } finally {
      setSavingSingle(false);
    }
  };

  const getServiceAreaZipCount = (areaId: string) => {
    return serviceZipcodes.filter(zip => zip.service_area_id === areaId).length;
  };

  const getServiceAreaZipcodes = (areaId: string) => {
    return serviceZipcodes
      .filter(zip => zip.service_area_id === areaId)
      .map(zip => zip.zipcode)
      .sort();
  };

  const isZipcodeActive = (zipcode: string) => {
    return activeZipcodes.includes(zipcode);
  };

  const toggleAreaExpansion = (areaId: string) => {
    setExpandedAreas(prev => ({
      ...prev,
      [areaId]: !prev[areaId]
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Service Area Settings
        </CardTitle>
        <CardDescription>
          Manage the areas and ZIP codes where you provide services. Only bookings in your active areas will be assigned to you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="areas" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Areas ({serviceAreas.length})
            </TabsTrigger>
            <TabsTrigger value="zipcodes" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              ZIP Codes ({allZipcodes.length})
            </TabsTrigger>
          </TabsList>

          {/* Map-based Areas Tab */}
          <TabsContent value="areas" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Draw Service Areas</h3>
                <Badge variant="secondary">
                  {serviceAreas.filter(area => area.is_active).length} Active
                </Badge>
              </div>
              
              {/* Map Component */}
              <ServiceAreaMap 
                workerId={user?.id} 
                onServiceAreaUpdate={fetchServiceAreas} 
                isActive={activeTab === 'areas'}
              />
              
              {/* Service Areas List */}
              {serviceAreas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Your Service Areas</h4>
                  {serviceAreas.map((area) => {
                    const areaZipcodes = getServiceAreaZipcodes(area.id);
                    const isExpanded = expandedAreas[area.id] || false;
                    
                    return (
                      <Collapsible key={area.id} open={isExpanded} onOpenChange={() => toggleAreaExpansion(area.id)}>
                        <div className="border rounded-lg">
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3 flex-1">
                              <Switch
                                checked={area.is_active}
                                onCheckedChange={(checked) => toggleServiceAreaStatus(area.id, checked)}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{area.area_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {getServiceAreaZipCount(area.id)} ZIP codes
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {area.is_active ? (
                                <Badge variant="default">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                              {areaZipcodes.length > 0 && (
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteServiceArea(area.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {areaZipcodes.length > 0 && (
                            <CollapsibleContent>
                              <div className="px-3 pb-3 border-t">
                                <div className="pt-3">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    ZIP Codes ({areaZipcodes.length})
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {areaZipcodes.map((zipcode) => (
                                      <Badge
                                        key={zipcode}
                                        variant={area.is_active ? "default" : "secondary"}
                                        className="text-xs font-mono"
                                      >
                                        {zipcode}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          )}
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ZIP Codes Tab */}
          <TabsContent value="zipcodes" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">ZIP Code Coverage</h3>
                <Badge variant="secondary">
                  {activeZipcodes.length} Active ZIPs
                </Badge>
              </div>

              {/* Add ZIP Codes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add ZIP Codes</CardTitle>
                  <CardDescription>
                    Enter ZIP codes separated by commas or spaces
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="single-zip">Quick add by ZIP</Label>
                    <div className="flex gap-2">
                      <Input
                        id="single-zip"
                        placeholder="e.g. 10001"
                        value={singleZipcode}
                        onChange={(e) => setSingleZipcode(e.target.value)}
                        maxLength={5}
                        pattern="\d{5}"
                      />
                      <Button
                        onClick={handleAddSingleZip}
                        disabled={!/^\d{5}$/.test(singleZipcode) || savingSingle}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {savingSingle ? 'Adding...' : 'Add ZIP'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zipcode-input">Add multiple ZIPs</Label>
                    <Textarea
                      id="zipcode-input"
                      placeholder="e.g. 75201, 75202, 75203"
                      value={newZipcodes}
                      onChange={(e) => setNewZipcodes(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleAddZipcodes}
                    disabled={!newZipcodes.trim() || savingZips}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {savingZips ? 'Adding...' : 'Add ZIP Codes'}
                  </Button>
                </CardContent>
              </Card>

              {/* ZIP Codes List */}
              {allZipcodes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search ZIP codes..."
                        value={zipSearchTerm}
                        onChange={(e) => setZipSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {zipSearchTerm && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setZipSearchTerm('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {filteredZipcodes.map((zipcode) => (
                      <div
                        key={zipcode}
                        className={`flex items-center justify-between p-2 border rounded ${
                          isZipcodeActive(zipcode) 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border'
                        }`}
                      >
                        <span className="text-sm font-mono">{zipcode}</span>
                        {isZipcodeActive(zipcode) ? (
                          <Eye className="h-3 w-3 text-primary" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>

                  {filteredZipcodes.length === 0 && zipSearchTerm && (
                    <div className="text-center py-8 text-muted-foreground">
                      No ZIP codes found matching "{zipSearchTerm}"
                    </div>
                  )}
                </div>
              )}

              {allZipcodes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No ZIP codes added yet. Use the map or add ZIP codes manually above.
                </div>
              )}

              {/* ZIP Code Tester */}
              {allZipcodes.length > 0 && (
                <ZipCodeTester activeZipcodes={activeZipcodes} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};