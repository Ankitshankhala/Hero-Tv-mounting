
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { X, User, Mail, Phone, MapPin, Calendar, ArrowRight, Shield, Star } from 'lucide-react';

interface InlineBookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export const InlineBookingFlow = ({ isOpen, onClose, onSubmit }: InlineBookingFlowProps) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    zipcode: '',
    address: '',
    city: '',
    region: '',
    specialInstructions: ''
  });

  const handleZipcodeChange = (zipcode: string, cityState?: string) => {
    setFormData(prev => ({ ...prev, zipcode }));
    
    if (cityState) {
      const [city, state] = cityState.split(', ');
      setFormData(prev => ({ 
        ...prev,
        city: city || prev.city,
        region: prev.region || 'downtown'
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  const isFormValid = 
    formData.customerName && 
    formData.customerEmail && 
    formData.customerPhone &&
    formData.address && 
    formData.zipcode;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modern Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 text-white p-8 rounded-t-3xl">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Calendar className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Book Your Service</h2>
              <p className="text-blue-100 text-lg mt-1">Complete your booking in just a few steps</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center space-x-2 mt-6">
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Star className="h-4 w-4 text-yellow-300" />
              <span className="text-sm font-medium">Quick Setup</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Customer Information Section */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Your Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="customerName" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-500" />
                  <span>Full Name</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Enter your full name"
                  className="h-12 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="customerEmail" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span>Email Address</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="your.email@example.com"
                  className="h-12 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="customerPhone" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-blue-500" />
                  <span>Phone Number</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="h-12 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200"
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
                  className="[&_label]:text-sm [&_label]:font-semibold [&_label]:text-gray-700 [&_label]:flex [&_label]:items-center [&_label]:space-x-2 [&_input]:h-12 [&_input]:text-base [&_input]:border-2 [&_input]:border-gray-200 [&_input]:focus:border-blue-500 [&_input]:rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Service Location Section */}
          <div className="space-y-6 pt-6 border-t border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-green-100 rounded-xl">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Service Location</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="address" className="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span>Complete Service Address</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street, Apartment 4B, City, State"
                  className="h-12 text-base border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl transition-all duration-200"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="city" className="text-sm font-semibold text-gray-700">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="h-12 text-base border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl transition-all duration-200"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="region" className="text-sm font-semibold text-gray-700">
                    Service Region <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={formData.region} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                  >
                    <SelectTrigger className="h-12 text-base border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all duration-200">
                      <SelectValue placeholder="Select your area" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
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
                <Label htmlFor="specialInstructions" className="text-sm font-semibold text-gray-700">
                  Special Instructions (Optional)
                </Label>
                <Textarea
                  id="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Any special instructions, access codes, parking info, or specific requests..."
                  className="min-h-[100px] text-base border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl resize-none transition-all duration-200"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex justify-center pt-4">
            <div className="inline-flex items-center space-x-3 bg-gray-50 border border-gray-200 rounded-full px-4 py-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-gray-600">Your information is secure and encrypted</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <Button 
              type="submit"
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={!isFormValid}
            >
              Continue to Schedule
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
