
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Settings, Edit, Trash2, Clock, DollarSign, Image, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Service } from '@/hooks/useServicesData';

interface SortableServiceItemProps {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onToggleVisibility: (serviceId: string) => void;
}

export const SortableServiceItem: React.FC<SortableServiceItemProps> = ({
  service,
  onEdit,
  onDelete,
  onToggleVisibility
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`hover:bg-blue-50 transition-colors duration-200 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${!service.is_visible ? 'opacity-50 bg-gray-50' : ''}`}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-gray-100"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          <span className="font-medium text-sm text-gray-600">
            #{service.sort_order}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.name}
            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
            <Image className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium text-gray-900">
        {service.name}
        {!service.is_visible && <span className="ml-2 text-xs text-gray-500">(Hidden)</span>}
      </TableCell>
      <TableCell className="max-w-xs">
        <p className="text-sm text-gray-600 truncate">
          {service.description || 'No description provided'}
        </p>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-1">
          <DollarSign className="h-4 w-4 text-green-600" />
          <span className="text-green-600 font-semibold">
            {formatPrice(service.base_price)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-1">
          <Clock className="h-4 w-4 text-blue-600" />
          <span className="text-blue-600 font-medium">
            {formatDuration(service.duration_minutes)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleVisibility(service.id)}
            className={`hover:bg-gray-100 hover:border-gray-300 ${
              !service.is_visible ? 'text-gray-500' : 'text-blue-600'
            }`}
            title={service.is_visible ? 'Hide service' : 'Show service'}
          >
            {service.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(service)}
            className="hover:bg-blue-100 hover:border-blue-300"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(service)}
            className="hover:bg-red-100 hover:border-red-300 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
