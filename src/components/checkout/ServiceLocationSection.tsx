
import React from 'react';
import { MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ServiceLocationSectionProps {
  formData: {
    address: string;
  };
  errors: any;
  touched: any;
  onInputChange: (field: string, value: string) => void;
  onBlur: (field: string) => void;
}

export const ServiceLocationSection = ({
  formData,
  errors,
  touched,
  onInputChange,
  onBlur
}: ServiceLocationSectionProps) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-blue-800 flex items-center mb-6">
        <MapPin className="h-5 w-5 text-blue-600 mr-2" />
        Service Location
      </h3>
      
      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span>Complete Service Address</span>
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => onInputChange('address', e.target.value)}
          onBlur={() => onBlur('address')}
          placeholder="123 Main Street, Apartment 4B, City, State"
          className="h-12 bg-blue-50 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-gray-900 placeholder:text-gray-500"
        />
        {errors.address && touched.address && (
          <p className="text-sm text-red-600">{errors.address}</p>
        )}
      </div>
    </div>
  );
};
