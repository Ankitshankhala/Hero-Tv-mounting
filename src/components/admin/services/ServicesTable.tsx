
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableServiceItem } from '../SortableServiceItem';
import { Service } from '@/hooks/useServicesData';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface ServicesTableProps {
  services: Service[];
  searchTerm: string;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onReorder: (reorderedServices: Service[]) => void;
  onToggleVisibility: (serviceId: string) => void;
}

export const ServicesTable: React.FC<ServicesTableProps> = ({
  services,
  searchTerm,
  onEdit,
  onDelete,
  onReorder,
  onToggleVisibility
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = filteredServices.findIndex(service => service.id === active.id);
      const newIndex = filteredServices.findIndex(service => service.id === over?.id);

      const reorderedServices = arrayMove(filteredServices, oldIndex, newIndex);
      onReorder(reorderedServices);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="font-semibold">Order</TableHead>
            <TableHead className="font-semibold">Image</TableHead>
            <TableHead className="font-semibold">Service Name</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
            <TableHead className="font-semibold">Price</TableHead>
            <TableHead className="font-semibold">Duration</TableHead>
            <TableHead className="font-semibold text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredServices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                {searchTerm ? 'No services found matching your search.' : 'No services available. Add your first service to get started.'}
              </TableCell>
            </TableRow>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={filteredServices.map(service => service.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredServices.map((service) => (
                  <SortableServiceItem
                    key={service.id}
                    service={service}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleVisibility={onToggleVisibility}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
