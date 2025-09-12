import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
interface Worker {
  id: string;
  name: string;
  service_areas: Array<{
    id: string;
    area_name: string;
    is_active: boolean;
  }>;
}
interface BulkZipcodeAssignmentProps {
  workers: Worker[];
  onAssignZipcodes: (workerId: string, existingAreaId: string, zipcodes: string[], mode?: 'append' | 'replace_all') => Promise<void>;
}
export const BulkZipcodeAssignment: React.FC<BulkZipcodeAssignmentProps> = ({
  workers,
  onAssignZipcodes
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [zipcodesText, setZipcodesText] = useState('');
  const [mode, setMode] = useState<'append' | 'replace_all'>('append');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    toast
  } = useToast();
  const selectedWorker = workers.find(w => w.id === selectedWorkerId);
  const activeAreas = selectedWorker?.service_areas?.filter(area => area.is_active) || [];
  const parseZipcodes = (text: string): string[] => {
    return text.split(/[\s,\n]+/).map(zip => zip.trim()).filter(zip => /^\d{5}$/.test(zip));
  };
  const handleSubmit = async () => {
    if (!selectedWorkerId || !selectedAreaId || !zipcodesText.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    const zipcodes = parseZipcodes(zipcodesText);
    if (zipcodes.length === 0) {
      toast({
        title: "Error",
        description: "Please enter valid 5-digit ZIP codes",
        variant: "destructive"
      });
      return;
    }

    // Require confirmation for replace_all mode
    if (mode === 'replace_all' && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }
    setIsLoading(true);
    try {
      await onAssignZipcodes(selectedWorkerId, selectedAreaId, zipcodes, mode);
      setIsOpen(false);
      setSelectedWorkerId('');
      setSelectedAreaId('');
      setZipcodesText('');
      setMode('append');
      setShowConfirmation(false);
      toast({
        title: "Success",
        description: `Successfully ${mode === 'append' ? 'added' : 'replaced'} ${zipcodes.length} ZIP codes`
      });
    } catch (error) {
      // Error is handled by the parent component
    } finally {
      setIsLoading(false);
    }
  };
  const handleConfirmReplace = async () => {
    setShowConfirmation(false);
    handleSubmit();
  };
  const handleWorkerChange = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setSelectedAreaId(''); // Reset area selection
  };
  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Bulk ZIP Code Assignment
          </DialogTitle>
          <DialogDescription>
            Select a worker and service area, then enter ZIP codes to assign to their coverage area.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="worker-select">Select Worker</Label>
            <Select value={selectedWorkerId} onValueChange={handleWorkerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a worker..." />
              </SelectTrigger>
              <SelectContent>
                {workers.map(worker => <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedWorkerId && <div>
              <Label htmlFor="area-select">Select Service Area</Label>
              <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an area..." />
                </SelectTrigger>
                <SelectContent>
                  {activeAreas.map(area => <SelectItem key={area.id} value={area.id}>
                      {area.area_name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
              {activeAreas.length === 0 && <p className="text-sm text-muted-foreground mt-1">
                  No active service areas found for this worker.
                </p>}
            </div>}

          <div>
            <Label htmlFor="zipcodes">ZIP Codes</Label>
            <Textarea id="zipcodes" placeholder="Enter ZIP codes separated by commas, spaces, or new lines&#10;Example: 78613, 78626, 78628" value={zipcodesText} onChange={e => setZipcodesText(e.target.value)} rows={4} />
          {zipcodesText && <p className="text-sm text-muted-foreground mt-1">
              {parseZipcodes(zipcodesText).length} valid ZIP codes found
            </p>}
        </div>

        <div>
          <Label htmlFor="mode">Assignment Mode</Label>
          <Select value={mode} onValueChange={(value: 'append' | 'replace_all') => setMode(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="append">Add to existing ZIP codes</SelectItem>
              <SelectItem value="replace_all">Replace all ZIP codes</SelectItem>
            </SelectContent>
          </Select>
          {mode === 'replace_all' && <p className="text-sm text-amber-600 mt-1">
              ⚠️ This will remove all existing ZIP codes for this worker
            </p>}
        </div>

        {showConfirmation && mode === 'replace_all' && <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="text-sm text-amber-800 font-medium">
              Are you sure you want to replace all ZIP codes?
            </p>
            <p className="text-sm text-amber-700 mt-1">
              This will remove all existing coverage and replace with {parseZipcodes(zipcodesText).length} new ZIP codes.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => setShowConfirmation(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmReplace} variant="destructive">
                Confirm Replace
              </Button>
            </div>
          </div>}

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !selectedWorkerId || !selectedAreaId || !zipcodesText.trim()} className="flex-1" variant={mode === 'replace_all' && !showConfirmation ? 'destructive' : 'default'}>
            {isLoading ? 'Assigning...' : mode === 'replace_all' && !showConfirmation ? 'Replace All ZIP Codes' : 'Assign ZIP Codes'}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>;
};