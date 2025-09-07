
import React from 'react';
import { User, Mail, Phone, MapPin, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ValidatedInput } from '@/components/ui/ValidatedInput';

interface ContactInfoSectionProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    zipcode: string;
  };
  errors: any;
  touched: any;
  zipcodeValid: boolean;
  cityState: string;
  hasServiceCoverage: boolean;
  workerCount: number;
  onInputChange: (field: string, value: string) => void;
  onBlur: (field: string) => void;
  onZipcodeChange: (zipcode: string, cityStateData?: string) => void;
}

export const ContactInfoSection = ({ 
  formData, 
  errors, 
  touched, 
  zipcodeValid, 
  cityState, 
  hasServiceCoverage,
  workerCount,
  onInputChange, 
  onBlur, 
  onZipcodeChange 
}: ContactInfoSectionProps) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-blue-800 flex items-center mb-6">
        <User className="h-5 w-5 text-blue-600 mr-2" />
        Contact Information
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <User className="h-4 w-4 text-blue-600" />
            <span>Full Name</span>
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onInputChange('name', e.target.value)}
            onBlur={() => onBlur('name')}
            placeholder="Enter your full name"
            className="text-black h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          />
          {errors.name && touched.name && (
            <p className="text-sm text-red-600">{errors.name}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <span>Email Address</span>
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => onInputChange('email', e.target.value)}
            onBlur={() => onBlur('email')}
            placeholder="your.email@example.com"
            className="text-black h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          />
          {errors.email && touched.email && (
            <p className="text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <Phone className="h-4 w-4 text-blue-600" />
            <span>Phone Number</span>
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => onInputChange('phone', e.target.value)}
            onBlur={() => onBlur('phone')}
            placeholder="(555) 123-4567"
            className="text-black h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          />
          {errors.phone && touched.phone && (
            <p className="text-sm text-red-600">{errors.phone}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="zipcode" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span>ZIP Code</span>
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="zipcode"
            value={formData.zipcode}
            onChange={(e) => onZipcodeChange(e.target.value)}
            placeholder="Enter 5-digit ZIP code"
            maxLength={5}
            className="text-black h-12 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* Zipcode confirmation and service coverage */}
      {zipcodeValid && cityState && (
        <div className="mt-6 space-y-3">
          {/* Location confirmation */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                Service location: <span className="font-medium">{cityState}</span>
              </span>
            </div>
          </div>
          
          {/* Service coverage status */}
          {hasServiceCoverage ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-700">
                  Service available • {workerCount} {workerCount === 1 ? 'worker' : 'workers'} in your area
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-red-700">
                  Service not available in this area
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
