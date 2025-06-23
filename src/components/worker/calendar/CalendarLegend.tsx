
import React from 'react';
import { Badge } from '@/components/ui/badge';

export const CalendarLegend = () => {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Badge className="bg-yellow-500">Pending</Badge>
      <Badge className="bg-green-500">Confirmed</Badge>
      <Badge className="bg-blue-500">In Progress</Badge>
      <Badge className="bg-gray-500">Completed</Badge>
      <Badge className="bg-red-500">Cancelled</Badge>
    </div>
  );
};
