
import React from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export const ServicesHeader = () => {
  return (
    <CardHeader className="pb-4">
      <CardTitle className="flex items-center space-x-2 text-xl">
        <Settings className="h-6 w-6 text-blue-600" />
        <span>Services Management</span>
      </CardTitle>
      <p className="text-gray-600">Manage your service offerings and pricing. Drag and drop to reorder services.</p>
    </CardHeader>
  );
};
