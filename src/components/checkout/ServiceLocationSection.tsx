
import React from 'react';
import { MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ValidatedInput } from '@/components/ui/ValidatedInput';

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
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center mb-6">
        <MapPin className="h-5 w-5 text-blue-600 mr-2" />
        Service Location
      </h3>
      
      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span>Complete Service Address</span>
          <span className="text-red-500">*</span>
        </Label>
        <ValidatedInput
          id="address"
          label=""
          value={formData.address}
          onChange={(value) => onInputChange('address', value)}
          onBlur={() => onBlur('address')}
          error={errors.address}
          touched={touched.address}
          required
          autoFormat="address"
          placeholder="123 Main Street, Apartment 4B, City, State"
          className="h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
        />
      </div>
    </div>
  );
};
