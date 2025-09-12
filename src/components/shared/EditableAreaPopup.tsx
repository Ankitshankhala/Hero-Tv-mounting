import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Save, X, MapPin, Calendar, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as L from 'leaflet';

interface ServiceArea {
  id: string;
  area_name: string;
  polygon_coordinates: any;
  is_active: boolean;
  created_at: string;
  worker_id?: string;
  zipcode_list?: string[];
}

interface Worker {
  id: string;
  name: string;
}

interface EditableAreaPopupProps {
  area: ServiceArea;
  worker?: Worker;
  onNameUpdate?: (areaId: string, newName: string) => Promise<boolean>;
  onClose?: () => void;
  zipCodeCount?: number;
}

const EditableAreaPopup: React.FC<EditableAreaPopupProps> = ({
  area,
  worker,
  onNameUpdate,
  onClose,
  zipCodeCount
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(area.area_name);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
      setIsEditing(false);
      return;
    }

    if (!onNameUpdate) {
      toast({
        title: "Error",
        description: "Name update function not available",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await onNameUpdate(area.id, editedName.trim());
      if (success) {
        setIsEditing(false);
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
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border p-4 min-w-[280px] max-w-[350px]">
      {/* Header with editable name */}
      <div className="flex items-center justify-between mb-3">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={handleKeyPress}
              className="h-8 text-sm font-semibold"
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
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-base text-gray-900 truncate flex-1" title={area.area_name}>
              {area.area_name}
            </h3>
            {onNameUpdate && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 p-0 opacity-60 hover:opacity-100 ml-2"
                title="Edit area name"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Area details */}
      <div className="space-y-2 text-sm">
        {worker && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-3 w-3" />
            <span>Worker: {worker.name}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-gray-600">
          <Activity className="h-3 w-3" />
          <span>Status: </span>
          <span className={`font-medium ${area.is_active ? 'text-green-600' : 'text-red-600'}`}>
            {area.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-3 w-3" />
          <span>Created: {new Date(area.created_at).toLocaleDateString()}</span>
        </div>

        {(zipCodeCount !== undefined || area.zipcode_list?.length) && (
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {zipCodeCount ?? area.zipcode_list?.length ?? 0} ZIP codes
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {onClose && (
        <div className="mt-3 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
};

// Utility function to create and bind editable popups to Leaflet polygons
export const bindEditablePopup = (
  polygon: L.Polygon | L.GeoJSON,
  area: ServiceArea,
  worker?: Worker,
  onNameUpdate?: (areaId: string, newName: string) => Promise<boolean>,
  zipCodeCount?: number
) => {
  // Create a container div for the React component
  const popupContainer = document.createElement('div');
  
  // Create and render the React component
  const root = createRoot(popupContainer);
  
  const handleClose = () => {
    polygon.closePopup();
  };

  root.render(
    <EditableAreaPopup
      area={area}
      worker={worker}
      onNameUpdate={onNameUpdate}
      onClose={handleClose}
      zipCodeCount={zipCodeCount}
    />
  );

  // Bind the popup to the polygon
  polygon.bindPopup(popupContainer, {
    maxWidth: 400,
    className: 'editable-area-popup'
  });

  // Clean up when popup is closed
  polygon.on('popupclose', () => {
    // Small delay to allow for any pending operations
    setTimeout(() => {
      try {
        root.unmount();
      } catch (e) {
        // Ignore unmount errors
      }
    }, 100);
  });

  return polygon;
};

// Helper function for backward compatibility with existing popup content
export const createEditablePopupContent = (
  area: ServiceArea,
  worker?: Worker,
  onNameUpdate?: (areaId: string, newName: string) => Promise<boolean>,
  zipCodeCount?: number
) => {
  const editButton = onNameUpdate ? `
    <button 
      class="edit-area-name-btn bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded ml-2 transition-colors" 
      data-area-id="${area.id}"
      data-area-name="${area.area_name}"
      title="Edit area name"
    >
      Edit
    </button>
  ` : '';

  return `
    <div class="p-3 min-w-[250px]">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-bold text-sm text-gray-900">${area.area_name}</h3>
        ${editButton}
      </div>
      ${worker ? `<p class="text-xs text-gray-600 mb-1 flex items-center gap-1">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path>
        </svg>
        Worker: ${worker.name}
      </p>` : ''}
      <p class="text-xs mb-1 flex items-center gap-1">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd"></path>
        </svg>
        Status: <span class="font-medium ${area.is_active ? 'text-green-600' : 'text-red-600'}">${area.is_active ? 'Active' : 'Inactive'}</span>
      </p>
      <p class="text-xs mb-1 flex items-center gap-1">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
        </svg>
        Created: ${new Date(area.created_at).toLocaleDateString()}
      </p>
      ${zipCodeCount !== undefined || area.zipcode_list?.length ? `
        <div class="mt-2">
          <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
            ${zipCodeCount ?? area.zipcode_list?.length ?? 0} ZIP codes
          </span>
        </div>
      ` : ''}
    </div>
  `;
};

export default EditableAreaPopup;
