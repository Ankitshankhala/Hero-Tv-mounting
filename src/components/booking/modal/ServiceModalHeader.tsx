
import React from 'react';
import { X, Monitor } from 'lucide-react';

interface ServiceModalHeaderProps {
  serviceName: string;
  onClose: () => void;
}

export const ServiceModalHeader = ({ serviceName, onClose }: ServiceModalHeaderProps) => {
  return (
    <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-4 sm:py-6 rounded-t-2xl">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="flex items-center space-x-3">
        <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
          <Monitor className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Configure {serviceName}</h2>
          <p className="text-blue-100 text-sm">Customize your service options</p>
        </div>
      </div>
    </div>
  );
};
