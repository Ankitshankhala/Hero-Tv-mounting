import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { X, Plus, MapPin, Loader2 } from 'lucide-react';

interface Worker {
  id: string;
  name: string;
  email: string;
}

interface WorkerZip {
  zipcode: string;
  service_area_id: string;
  area_name: string;
}

interface AdminWorkerCoverageModalProps {
  worker: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminWorkerCoverageModal = ({ worker, isOpen, onClose, onSuccess }: AdminWorkerCoverageModalProps) => {
  const [currentZips, setCurrentZips] = useState<WorkerZip[]>([]);
  const [newZipInput, setNewZipInput] = useState('');
  const [newZips, setNewZips] = useState<string[]>([]);
  const [areaName, setAreaName] = useState('');
  const [mode, setMode] = useState<'append' | 'replace_all'>('append');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zipSuggestions, setZipSuggestions] = useState<{zipcode: string; city: string; state: string}[]>([]);
  const { toast } = useToast();

  // Fetch current ZIP codes for the worker
  const fetchCurrentZips = async () => {
    if (!worker) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worker_service_zipcodes')
        .select(`
          zipcode,
          service_area_id,
          worker_service_areas!inner(area_name, is_active)
        `)
        .eq('worker_id', worker.id)
        .eq('worker_service_areas.is_active', true);

      if (error) throw error;

      const zips = data?.map(item => ({
        zipcode: item.zipcode,
        service_area_id: item.service_area_id,
        area_name: (item.worker_service_areas as any)?.area_name || 'Unknown Area'
      })) || [];

      setCurrentZips(zips);
    } catch (error) {
      console.error('Error fetching current ZIPs:', error);
      toast({
        title: "Error",
        description: "Failed to load current ZIP codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Search for ZIP suggestions
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

  // Handle adding ZIP codes
  const handleAddZip = (zip: string) => {
    const cleanZip = zip.replace(/\D/g, '').slice(0, 5);
    if (cleanZip.length === 5 && !newZips.includes(cleanZip)) {
      setNewZips([...newZips, cleanZip]);
      setNewZipInput('');
      setZipSuggestions([]);
    }
  };

  const handleRemoveNewZip = (zip: string) => {
    setNewZips(newZips.filter(z => z !== zip));
  };

  // Handle bulk paste
  const handleBulkPaste = (text: string) => {
    const zipPattern = /\b\d{5}\b/g;
    const foundZips = text.match(zipPattern) || [];
    const uniqueZips = [...new Set([...newZips, ...foundZips])];
    setNewZips(uniqueZips);
  };

  // Save changes
  const handleSave = async () => {
    if (!worker || newZips.length === 0) {
      toast({
        title: "No Changes",
        description: "Please add at least one ZIP code",
        variant: "destructive",
      });
      return;
    }

    if (mode === 'replace_all' && !confirm(`This will replace ALL existing ZIP codes for ${worker.name}. Are you sure?`)) {
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-service-area-manager', {
        body: {
          workerId: worker.id,
          areaName: areaName || `Admin Assigned - ${new Date().toLocaleDateString()}`,
          zipcodesOnly: newZips,
          mode: mode
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to save ZIP codes');
      }

      toast({
        title: "Success",
        description: `ZIP codes ${mode === 'replace_all' ? 'replaced' : 'added'} successfully`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving ZIP codes:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save ZIP codes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && worker) {
      fetchCurrentZips();
      setNewZips([]);
      setNewZipInput('');
      setAreaName('');
      setMode('append');
      setZipSuggestions([]);
    }
  }, [isOpen, worker]);

  if (!worker) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Manage Coverage - {worker.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Coverage */}
          <div>
            <Label className="text-sm font-medium">Current ZIP Code Coverage ({currentZips.length})</Label>
            {loading ? (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading current coverage...
              </div>
            ) : (
              <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-3">
                {currentZips.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {currentZips.map((zip) => (
                      <Badge key={`${zip.zipcode}-${zip.service_area_id}`} variant="secondary" className="text-xs">
                        {zip.zipcode}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No ZIP codes assigned</p>
                )}
              </div>
            )}
          </div>

          {/* Add New ZIPs */}
          <div>
            <Label htmlFor="zipInput" className="text-sm font-medium">Add ZIP Codes</Label>
            <div className="mt-2 space-y-3">
              <div className="relative">
                <Input
                  id="zipInput"
                  placeholder="Enter ZIP code or search city (e.g., 75001 or Dallas)"
                  value={newZipInput}
                  onChange={(e) => {
                    setNewZipInput(e.target.value);
                    searchZipSuggestions(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddZip(newZipInput);
                    }
                  }}
                />
                {zipSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg">
                    {zipSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.zipcode}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                        onClick={() => handleAddZip(suggestion.zipcode)}
                      >
                        {suggestion.zipcode} - {suggestion.city}, {suggestion.state}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddZip(newZipInput)}
                  disabled={!newZipInput}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add ZIP
                </Button>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Bulk Paste</Label>
                <Textarea
                  placeholder="Paste ZIP codes here (will extract 5-digit codes automatically)"
                  className="mt-1 h-20 text-sm"
                  onChange={(e) => handleBulkPaste(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* New ZIPs to be added */}
          {newZips.length > 0 && (
            <div>
              <Label className="text-sm font-medium">New ZIP Codes to Add ({newZips.length})</Label>
              <div className="mt-2 border rounded-md p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {newZips.map((zip) => (
                    <Badge key={zip} variant="default" className="text-xs">
                      {zip}
                      <button
                        onClick={() => handleRemoveNewZip(zip)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Configuration */}
          {newZips.length > 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="areaName" className="text-sm font-medium">Service Area Name</Label>
                <Input
                  id="areaName"
                  placeholder={`Admin Assigned - ${new Date().toLocaleDateString()}`}
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Action</Label>
                <Select value={mode} onValueChange={(value: 'append' | 'replace_all') => setMode(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Add to existing coverage</SelectItem>
                    <SelectItem value="replace_all">Replace all existing coverage</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === 'append' 
                    ? 'New ZIP codes will be added alongside existing ones' 
                    : 'All existing ZIP codes will be replaced with the new ones'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || newZips.length === 0}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'replace_all' ? 'Replace Coverage' : 'Add Coverage'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};