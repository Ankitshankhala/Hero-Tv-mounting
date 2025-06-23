
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { User, Mail, Phone, MapPin } from 'lucide-react';

interface FormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  zipcode: string;
  address: string;
  city: string;
  region: string;
  specialInstructions: string;
}

interface ContactLocationStepProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  handleZipcodeChange: (zipcode: string, cityState?: string) => void;
}

export const ContactLocationStep = ({
  formData,
  setFormData,
  handleZipcodeChange
}: ContactLocationStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Contact & Location Details</h3>
        <p className="text-gray-600">We need your information to schedule the service</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          <Label htmlFor="customerName" className="text-base font-medium flex items-center space-x-2">
            <User className="h-4 w-4 text-blue-600" />
            <span>Full Name *</span>
          </Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
            placeholder="Enter your full name"
            className="h-12"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="customerEmail" className="text-base font-medium flex items-center space-x-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <span>Email Address *</span>
          </Label>
          <Input
            id="customerEmail"
            type="email"
            value={formData.customerEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
            placeholder="your.email@example.com"
            className="h-12"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="customerPhone" className="text-base font-medium flex items-center space-x-2">
            <Phone className="h-4 w-4 text-blue-600" />
            <span>Phone Number *</span>
          </Label>
          <Input
            id="customerPhone"
            type="tel"
            value={formData.customerPhone}
            onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
            placeholder="(555) 123-4567"
            className="h-12"
          />
        </div>

        <div className="space-y-3">
          <ZipcodeInput
            id="zipcode"
            label="ZIP Code"
            value={formData.zipcode}
            onChange={handleZipcodeChange}
            required
            placeholder="12345"
            className="[&_input]:h-12"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="address" className="text-base font-medium flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-green-600" />
          <span>Service Address *</span>
        </Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="123 Main Street, Apartment 4B"
          className="h-12"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          <Label htmlFor="city" className="text-base font-medium">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            placeholder="Your city"
            className="h-12"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="region" className="text-base font-medium">Service Region</Label>
          <Select 
            value={formData.region} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select your area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="downtown">Downtown</SelectItem>
              <SelectItem value="north-side">North Side</SelectItem>
              <SelectItem value="east-side">East Side</SelectItem>
              <SelectItem value="west-end">West End</SelectItem>
              <SelectItem value="south-side">South Side</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="specialInstructions" className="text-base font-medium">Special Instructions</Label>
        <Textarea
          id="specialInstructions"
          value={formData.specialInstructions}
          onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
          placeholder="Any special instructions, access codes, parking info..."
          className="min-h-[100px]"
          rows={4}
        />
      </div>
    </div>
  );
};
