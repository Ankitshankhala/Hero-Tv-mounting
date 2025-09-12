import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Edit2, Save, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ServiceArea {
  id: string;
  area_name: string;
  polygon_coordinates: any;
  is_active: boolean;
  created_at: string;
  worker_id?: string;
}

interface AreaNameEditorProps {
  area: ServiceArea;
  onNameUpdate: (areaId: string, newName: string) => Promise<boolean>;
  trigger?: 'inline' | 'modal';
  className?: string;
  disabled?: boolean;
}

export const AreaNameEditor: React.FC<AreaNameEditorProps> = ({
  area,
  onNameUpdate,
  trigger = 'inline',
  className = '',
  disabled = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(area.area_name);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();

  // Update edited name when area prop changes
  useEffect(() => {
    setEditedName(area.area_name);
  }, [area.area_name]);

  const handleSave = async () => {
    if (!editedName.trim()) {
      toast({
        title: "Validation Error",
        description: "Area name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (editedName.trim() === area.area_name) {
      // No changes made
      setIsEditing(false);
      setShowModal(false);
      return;
    }

    setIsLoading(true);
    try {
      const success = await onNameUpdate(area.id, editedName.trim());
      if (success) {
        setIsEditing(false);
        setShowModal(false);
        toast({
          title: "Success",
          description: `Area renamed to "${editedName.trim()}"`,
        });
      }
    } catch (error) {
      console.error('Error updating area name:', error);
      toast({
        title: "Error",
        description: "Failed to update area name",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedName(area.area_name);
    setIsEditing(false);
    setShowModal(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Inline editing component
  const InlineEditor = () => (
    <div className={`flex items-center gap-2 ${className}`}>
      {isEditing ? (
        <>
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={handleKeyPress}
            className="h-8 text-sm"
            placeholder="Enter area name..."
            disabled={isLoading}
            autoFocus
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading || !editedName.trim()}
            className="h-8 w-8 p-0"
          >
            <Save className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium truncate max-w-[200px]" title={area.area_name}>
            {area.area_name}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            disabled={disabled}
            className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );

  // Modal editor component
  const ModalEditor = () => (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className={`h-8 w-8 p-0 opacity-60 hover:opacity-100 ${className}`}
      >
        <Edit2 className="h-3 w-3" />
      </Button>
      
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              Edit Area Name
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Name</label>
              <div className="p-2 bg-muted rounded text-sm text-muted-foreground">
                {area.area_name}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">New Name</label>
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter new area name..."
                disabled={isLoading}
                autoFocus
              />
              {!editedName.trim() && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  Area name is required
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading || !editedName.trim() || editedName.trim() === area.area_name}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return trigger === 'modal' ? <ModalEditor /> : <InlineEditor />;
};

// Hook for easy integration with existing map components
export const useAreaNameEditor = () => {
  return {
    AreaNameEditor,
    // Helper function to add edit capability to polygon popups
    createEditablePopupContent: (
      area: ServiceArea, 
      worker?: { name: string },
      onNameUpdate?: (areaId: string, newName: string) => Promise<boolean>
    ) => {
      return `
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-sm">${area.area_name}</h3>
            ${onNameUpdate ? `<button 
              class="edit-area-name-btn text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600" 
              data-area-id="${area.id}"
              data-area-name="${area.area_name}"
            >
              Edit
            </button>` : ''}
          </div>
          ${worker ? `<p class="text-xs text-gray-600 mb-1">Worker: ${worker.name}</p>` : ''}
          <p class="text-xs mb-1">Status: ${area.is_active ? 'Active' : 'Inactive'}</p>
          <p class="text-xs">Created: ${new Date(area.created_at).toLocaleDateString()}</p>
        </div>
      `;
    }
  };
};

export default AreaNameEditor;
