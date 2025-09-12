# Area Name Editor Integration Guide

This guide shows how to add area name editing functionality to existing map components in the Hero TV Mounting application.

## Overview

The area name editor provides a complete solution for editing service area names on maps with:
- ✅ Inline editing capabilities
- ✅ Modal dialog editing
- ✅ Interactive map popups
- ✅ Name validation
- ✅ Audit logging
- ✅ Integration with existing hooks

## Files Created

```
src/
├── components/
│   ├── shared/
│   │   ├── AreaNameEditor.tsx          # Main editor component
│   │   └── EditableAreaPopup.tsx       # Map popup component
│   ├── admin/
│   │   └── EnhancedServiceAreaMap.tsx  # Example integration
│   └── examples/
│       └── AreaNameEditorUsage.tsx     # Usage examples
└── hooks/
    └── useAreaNameEditor.ts            # Custom hook
```

## Quick Start

### 1. Basic Inline Editor

```tsx
import AreaNameEditor from '@/components/shared/AreaNameEditor';
import { useAreaNameEditor } from '@/hooks/useAreaNameEditor';

const MyComponent = () => {
  const { updateAreaName } = useAreaNameEditor({
    adminMode: true, // or false for worker mode
    workerId: 'worker-id' // required for worker mode
  });

  return (
    <AreaNameEditor
      area={serviceArea}
      onNameUpdate={updateAreaName}
      trigger="inline" // or "modal"
    />
  );
};
```

### 2. Map Integration

```tsx
import { bindEditablePopup } from '@/components/shared/EditableAreaPopup';
import { useAreaNameEditor } from '@/hooks/useAreaNameEditor';
import * as L from 'leaflet';

const MapComponent = () => {
  const { updateAreaName } = useAreaNameEditor({ adminMode: true });

  useEffect(() => {
    // Create your polygon
    const polygon = L.polygon(coordinates, options);
    
    // Bind editable popup
    bindEditablePopup(
      polygon,
      serviceArea,
      worker,
      updateAreaName,
      zipCodeCount
    );
    
    polygon.addTo(map);
  }, []);
};
```

## Integration with Existing Components

### AdminServiceAreaMap.tsx

Add the following imports and modifications:

```tsx
// Add imports
import { bindEditablePopup } from '@/components/shared/EditableAreaPopup';
import { useAreaNameEditor } from '@/hooks/useAreaNameEditor';

// In your component
const AdminServiceAreaMap = ({ workerId, workerName, ... }) => {
  // Add the hook
  const { updateAreaName } = useAreaNameEditor({
    adminMode: true,
    onSuccess: (areaId, newName) => {
      console.log(`Area ${areaId} renamed to ${newName}`);
      onServiceAreaUpdate?.(); // Refresh data
    }
  });

  // In your polygon creation effect
  useEffect(() => {
    // ... existing polygon creation code ...
    
    // Replace existing popup binding with:
    bindEditablePopup(
      polygon,
      area,
      { id: workerId, name: workerName },
      updateAreaName,
      area.zipcode_list?.length
    );
    
    // ... rest of code ...
  }, [updateAreaName]);
};
```

### ServiceAreaMap.tsx (Worker Component)

```tsx
// Add imports
import { bindEditablePopup } from '@/components/shared/EditableAreaPopup';
import { useAreaNameEditor } from '@/hooks/useAreaNameEditor';

// In your component
const ServiceAreaMap = ({ workerId, ... }) => {
  // Add the hook
  const { updateAreaName } = useAreaNameEditor({
    adminMode: false,
    workerId,
    onSuccess: (areaId, newName) => {
      onServiceAreaUpdate?.();
    }
  });

  // Update polygon creation
  useEffect(() => {
    serviceAreas.forEach(area => {
      const polygon = L.polygon(latLngs, options);
      
      // Use editable popup
      bindEditablePopup(
        polygon,
        area,
        undefined, // No worker info needed in worker view
        updateAreaName
      );
      
      drawnItems.addLayer(polygon);
    });
  }, [serviceAreas, updateAreaName]);
};
```

### WorkerServiceAreasMap.tsx (Admin Overview)

```tsx
// Add to existing click handler
polygon.on('click', () => {
  setSelectedAreaInfo({
    worker,
    area,
    zipCodes: areaZipCodes.sort()
  });
});

// Replace with editable popup
bindEditablePopup(
  polygon,
  area,
  worker,
  updateAreaName,
  areaZipCodes.length
);
```

## Advanced Usage

### Bulk Updates

```tsx
import { useBulkAreaNameEditor } from '@/hooks/useAreaNameEditor';

const BulkEditComponent = () => {
  const { updateMultipleAreaNames } = useBulkAreaNameEditor({
    adminMode: true
  });

  const handleBulkUpdate = async () => {
    const updates = [
      { areaId: 'area-1', newName: 'North District' },
      { areaId: 'area-2', newName: 'South District' }
    ];

    const results = await updateMultipleAreaNames(updates);
    console.log(`Success: ${results.success}, Failed: ${results.failed}`);
  };
};
```

### Custom Validation

```tsx
const { validateAreaName, checkNameExists } = useAreaNameEditor();

const handleNameChange = async (newName: string) => {
  // Validate format
  const validation = validateAreaName(newName);
  if (!validation.isValid) {
    setError(validation.error);
    return;
  }

  // Check for duplicates
  const exists = await checkNameExists(newName, currentAreaId);
  if (exists) {
    setError('Name already exists');
    return;
  }

  // Proceed with update
  await updateAreaName(areaId, newName);
};
```

## Component Props

### AreaNameEditor

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `area` | `ServiceArea` | - | Service area object |
| `onNameUpdate` | `(areaId: string, newName: string) => Promise<boolean>` | - | Update function |
| `trigger` | `'inline' \| 'modal'` | `'inline'` | Edit trigger type |
| `className` | `string` | `''` | CSS classes |
| `disabled` | `boolean` | `false` | Disable editing |

### bindEditablePopup

| Parameter | Type | Description |
|-----------|------|-------------|
| `polygon` | `L.Polygon \| L.GeoJSON` | Leaflet polygon |
| `area` | `ServiceArea` | Service area data |
| `worker` | `Worker` (optional) | Worker information |
| `onNameUpdate` | `function` (optional) | Update callback |
| `zipCodeCount` | `number` (optional) | ZIP codes count |

## Hook Options

### useAreaNameEditor

```tsx
const options = {
  workerId?: string;        // Required for worker mode
  adminMode?: boolean;      // Admin vs worker mode
  onSuccess?: (areaId: string, newName: string) => void;
  onError?: (error: Error) => void;
};
```

## Styling

The components use Tailwind CSS classes and are compatible with your existing design system. Key CSS classes:

```css
/* Custom popup styles */
.editable-area-popup .leaflet-popup-content-wrapper {
  padding: 0;
  border-radius: 8px;
}

/* Edit button hover effects */
.edit-area-name-btn:hover {
  transform: scale(1.05);
  transition: transform 0.2s;
}
```

## Database Integration

The editor automatically integrates with your existing database schema:

- Updates `worker_service_areas.area_name`
- Creates audit logs via `create_service_area_audit_log`
- Maintains data consistency
- Supports both admin and worker permissions

## Error Handling

Built-in error handling includes:

- Network failures
- Validation errors
- Permission errors
- Duplicate name detection
- User-friendly error messages

## Testing

Example test cases:

```tsx
// Test name validation
expect(validateAreaName('').isValid).toBe(false);
expect(validateAreaName('Valid Name').isValid).toBe(true);

// Test update function
const result = await updateAreaName('area-1', 'New Name');
expect(result).toBe(true);
```

## Migration Guide

To migrate existing components:

1. **Install dependencies**: All required components are included
2. **Add imports**: Import the editor components and hooks
3. **Replace popup bindings**: Use `bindEditablePopup` instead of static popups
4. **Add hooks**: Use `useAreaNameEditor` for update functionality
5. **Update handlers**: Replace existing edit handlers with the new system
6. **Test thoroughly**: Verify all functionality works as expected

## Troubleshooting

### Common Issues

1. **"Hook not working"**: Ensure you're passing the correct `workerId` for worker mode
2. **"Popup not rendering"**: Check that React DOM is properly set up for Leaflet integration
3. **"Updates not saving"**: Verify database permissions and network connectivity
4. **"Validation failing"**: Check name length and character restrictions

### Debug Mode

Enable debug logging:

```tsx
const { updateAreaName } = useAreaNameEditor({
  adminMode: true,
  onSuccess: (areaId, newName) => {
    console.log('✅ Success:', { areaId, newName });
  },
  onError: (error) => {
    console.error('❌ Error:', error);
  }
});
```

## Support

For additional help:

1. Check the usage examples in `AreaNameEditorUsage.tsx`
2. Review the complete integration in `EnhancedServiceAreaMap.tsx`
3. Examine existing hooks in `useAdminServiceAreas.ts` and `useWorkerServiceAreas.ts`

The area name editor is designed to be flexible and integrate seamlessly with your existing codebase while providing a rich user experience for managing service area names.
