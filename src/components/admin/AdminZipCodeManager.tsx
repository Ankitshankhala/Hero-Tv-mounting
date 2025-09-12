import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Trash2, 
  Plus, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  X,
  Download,
  Upload,
  RefreshCw,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminServiceAreas } from '@/hooks/useAdminServiceAreas';

interface WorkerZip {
  id: string;
  zipcode: string;
  service_area_id: string;
  from_manual: boolean;
  from_polygon: boolean;
  created_at: string;
  service_area?: {
    area_name: string;
  };
}

interface AdminZipCodeManagerProps {
  workerId: string;
  workerName: string;
  onZipCodeUpdate?: () => void;
}

const AdminZipCodeManager = ({ workerId, workerName, onZipCodeUpdate }: AdminZipCodeManagerProps) => {
  const [zipCodes, setZipCodes] = useState<WorkerZip[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZips, setSelectedZips] = useState<Set<string>>(new Set());
  const [filterSource, setFilterSource] = useState<'all' | 'manual' | 'polygon'>('all');
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [newZipInput, setNewZipInput] = useState('');
  const [zipSuggestions, setZipSuggestions] = useState<any[]>([]);
  const [addingZip, setAddingZip] = useState(false);
  const [removingZip, setRemovingZip] = useState<string | null>(null);
  const [bulkRemoving, setBulkRemoving] = useState(false);

  const { toast } = useToast();
  const { removeZipcodeFromWorker, addZipcodesToExistingArea, refreshData } = useAdminServiceAreas();

  useEffect(() => {
    if (workerId) {
      loadZipCodes();
    }
  }, [workerId]);

  const loadZipCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_service_zipcodes')
        .select(`
          id,
          zipcode,
          service_area_id,
          from_manual,
          from_polygon,
          created_at,
          service_area:worker_service_areas(area_name)
        `)
        .eq('worker_id', workerId)
        .order('zipcode');

      if (error) throw error;
      setZipCodes(data || []);
    } catch (error) {
      console.error('Error loading ZIP codes:', error);
      toast({
        title: "Error",
        description: "Failed to load ZIP codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchZipSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setZipSuggestions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('us_zip_codes')
        .select('zipcode, city, state')
        .or(`zipcode.ilike.${query}%,city.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      setZipSuggestions(data || []);
    } catch (error) {
      console.error('Error searching ZIP codes:', error);
    }
  };

  const handleAddZip = async (zipcode: string) => {
    const cleanZip = zipcode.replace(/\D/g, '').slice(0, 5);
    if (cleanZip.length !== 5) {
      toast({
        title: "Invalid ZIP Code",
        description: "Please enter a valid 5-digit ZIP code",
        variant: "destructive",
      });
      return;
    }

    if (zipCodes.some(zip => zip.zipcode === cleanZip)) {
      toast({
        title: "ZIP Code Exists",
        description: "This ZIP code is already assigned to this worker",
        variant: "destructive",
      });
      return;
    }

    setAddingZip(true);
    try {
      // Get the first active service area for this worker
      const { data: serviceAreas, error: areaError } = await supabase
        .from('worker_service_areas')
        .select('id')
        .eq('worker_id', workerId)
        .eq('is_active', true)
        .limit(1);

      if (areaError) throw areaError;

      if (!serviceAreas || serviceAreas.length === 0) {
        toast({
          title: "No Service Area",
          description: "Please create a service area first before adding ZIP codes",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('worker_service_zipcodes')
        .insert({
          worker_id: workerId,
          zipcode: cleanZip,
          service_area_id: serviceAreas[0].id,
          from_manual: true,
          from_polygon: false
        });

      if (error) throw error;

      toast({
        title: "ZIP Code Added",
        description: `Added ${cleanZip} to service area`,
      });

      setNewZipInput('');
      setZipSuggestions([]);
      await loadZipCodes();
      onZipCodeUpdate?.();
    } catch (error: any) {
      console.error('Error adding ZIP code:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add ZIP code",
        variant: "destructive",
      });
    } finally {
      setAddingZip(false);
    }
  };

  const handleRemoveZip = async (zipcode: string) => {
    setRemovingZip(zipcode);
    try {
      await removeZipcodeFromWorker(workerId, zipcode);
      toast({
        title: "ZIP Code Removed",
        description: `Removed ${zipcode}`,
      });
      await loadZipCodes();
      onZipCodeUpdate?.();
    } catch (error: any) {
      console.error('Error removing ZIP code:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove ZIP code",
        variant: "destructive",
      });
    } finally {
      setRemovingZip(null);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedZips.size === 0) return;

    setBulkRemoving(true);
    try {
      const removePromises = Array.from(selectedZips).map(zipcode => 
        removeZipcodeFromWorker(workerId, zipcode)
      );

      await Promise.all(removePromises);

      toast({
        title: "Bulk Removal Complete",
        description: `Removed ${selectedZips.size} ZIP codes`,
      });

      setSelectedZips(new Set());
      setShowBulkDelete(false);
      await loadZipCodes();
      onZipCodeUpdate?.();
    } catch (error: any) {
      console.error('Error bulk removing ZIP codes:', error);
      toast({
        title: "Error",
        description: "Failed to remove some ZIP codes",
        variant: "destructive",
      });
    } finally {
      setBulkRemoving(false);
    }
  };

  const handleSelectAll = () => {
    const filteredZips = getFilteredZipCodes();
    if (selectedZips.size === filteredZips.length) {
      setSelectedZips(new Set());
    } else {
      setSelectedZips(new Set(filteredZips.map(zip => zip.zipcode)));
    }
  };

  const handleSelectZip = (zipcode: string) => {
    const newSelected = new Set(selectedZips);
    if (newSelected.has(zipcode)) {
      newSelected.delete(zipcode);
    } else {
      newSelected.add(zipcode);
    }
    setSelectedZips(newSelected);
  };

  const getFilteredZipCodes = () => {
    return zipCodes.filter(zip => {
      const matchesSearch = zip.zipcode.includes(searchTerm) || 
        zip.service_area?.area_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterSource === 'all' || 
        (filterSource === 'manual' && zip.from_manual) ||
        (filterSource === 'polygon' && zip.from_polygon);

      return matchesSearch && matchesFilter;
    });
  };

  const filteredZips = getFilteredZipCodes();
  const allSelected = filteredZips.length > 0 && selectedZips.size === filteredZips.length;
  const someSelected = selectedZips.size > 0 && selectedZips.size < filteredZips.length;

  const exportZipCodes = () => {
    const csvContent = [
      'ZIP Code,Service Area,Source,Created At',
      ...filteredZips.map(zip => 
        `${zip.zipcode},"${zip.service_area?.area_name || 'Unknown'}",${zip.from_manual ? 'Manual' : 'Polygon'},"${new Date(zip.created_at).toLocaleString()}"`
      ).join('\n')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workerName.replace(/\s+/g, '_')}_zip_codes.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            ZIP Code Management - {workerName}
            <Badge variant="outline" className="ml-auto">
              {zipCodes.length} ZIP codes
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search ZIP codes or service areas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterSource} onValueChange={(value: any) => setFilterSource(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="manual">Manual Only</SelectItem>
                <SelectItem value="polygon">Polygon Only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadZipCodes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Add ZIP Code */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Enter ZIP code to add..."
                value={newZipInput}
                onChange={(e) => {
                  setNewZipInput(e.target.value);
                  searchZipSuggestions(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newZipInput.trim()) {
                    handleAddZip(newZipInput.trim());
                  }
                }}
              />
              {zipSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                  {zipSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-muted cursor-pointer"
                      onClick={() => {
                        setNewZipInput(suggestion.zipcode);
                        setZipSuggestions([]);
                        handleAddZip(suggestion.zipcode);
                      }}
                    >
                      <div className="font-medium">{suggestion.zipcode}</div>
                      <div className="text-sm text-muted-foreground">
                        {suggestion.city}, {suggestion.state}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button 
              onClick={() => handleAddZip(newZipInput)} 
              disabled={addingZip || !newZipInput.trim()}
            >
              {addingZip ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add ZIP
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedZips.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                {selectedZips.size} ZIP code{selectedZips.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedZips(new Set())}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Remove ZIP Codes
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove {selectedZips.size} ZIP code{selectedZips.size !== 1 ? 's' : ''}? 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkRemove}
                        disabled={bulkRemoving}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {bulkRemoving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Remove {selectedZips.size} ZIP Code{selectedZips.size !== 1 ? 's' : ''}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZIP Codes List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              ZIP Codes ({filteredZips.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportZipCodes}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredZips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ZIP codes found</p>
              <p className="text-sm">Add ZIP codes using the input above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select All Header */}
              <div className="flex items-center gap-3 p-2 border-b">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium text-muted-foreground">
                  Select All ({filteredZips.length})
                </span>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-1">
                  {filteredZips.map((zip) => (
                    <div
                      key={zip.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg"
                    >
                      <Checkbox
                        checked={selectedZips.has(zip.zipcode)}
                        onCheckedChange={() => handleSelectZip(zip.zipcode)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{zip.zipcode}</span>
                          <Badge variant={zip.from_manual ? 'default' : 'secondary'}>
                            {zip.from_manual ? 'Manual' : 'Polygon'}
                          </Badge>
                          {zip.service_area?.area_name && (
                            <Badge variant="outline">
                              {zip.service_area.area_name}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Added {new Date(zip.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={removingZip === zip.zipcode}
                          >
                            {removingZip === zip.zipcode ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Remove ZIP Code
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove ZIP code {zip.zipcode}? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveZip(zip.zipcode)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove ZIP Code
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminZipCodeManager;
