
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
  houseNumber: string;
  address: string;
  city: string;
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
        <h3 className="text-2xl font-bold text-white mb-2">Contact & Location Details</h3>
        <p className="text-slate-300">We need your information to schedule the service</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          <Label htmlFor="customerName" className="text-base font-medium flex items-center space-x-2 text-white">
            <User className="h-4 w-4 text-blue-400" />
            <span>Full Name *</span>
          </Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
            placeholder="Enter your full name"
            className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="customerEmail" className="text-base font-medium flex items-center space-x-2 text-white">
            <Mail className="h-4 w-4 text-blue-400" />
            <span>Email Address *</span>
          </Label>
          <Input
            id="customerEmail"
            type="email"
            value={formData.customerEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
            placeholder="your.email@example.com"
            className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="customerPhone" className="text-base font-medium flex items-center space-x-2 text-white">
            <Phone className="h-4 w-4 text-blue-400" />
            <span>Phone Number *</span>
          </Label>
          <Input
            id="customerPhone"
            type="tel"
            value={formData.customerPhone}
            onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
            placeholder="(555) 123-4567"
            className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400"
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
            className="[&_input]:h-12 [&_input]:bg-slate-700/50 [&_input]:border-slate-600 [&_input]:text-white [&_input]:placeholder-slate-400 [&_input]:focus:border-blue-400 [&_label]:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3">
          <Label htmlFor="houseNumber" className="text-base font-medium flex items-center space-x-2 text-white">
            <MapPin className="h-4 w-4 text-green-400" />
            <span>House Number *</span>
          </Label>
          <Input
            id="houseNumber"
            value={formData.houseNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, houseNumber: e.target.value }))}
            placeholder="123"
            className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="city" className="text-base font-medium text-white">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
            placeholder="Your city"
            className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="address" className="text-base font-medium flex items-center space-x-2 text-white">
          <MapPin className="h-4 w-4 text-green-400" />
          <span>Service Address *</span>
        </Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Main Street, Apartment 4B"
          className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400"
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="specialInstructions" className="text-base font-medium text-white">Special Instructions</Label>
        <Textarea
          id="specialInstructions"
          value={formData.specialInstructions}
          onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
          placeholder="Any special instructions, access codes, parking info..."
          className="min-h-[100px] bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400"
          rows={4}
        />
      </div>
    </div>
  );
};
