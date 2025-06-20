
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { X, User, Mail, Phone, MapPin, Calendar, ArrowRight, Shield, Star, Sparkles } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto border border-gray-100">
        {/* Ultra Modern Header */}
        <div className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white px-8 py-10 rounded-t-3xl overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]"></div>
            <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15),transparent_50%)]"></div>
          </div>
          
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 hover:bg-white/20 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="relative z-10">
            <div className="flex items-center space-x-4 mb-6">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30">
                <Sparkles className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-4xl font-bold mb-2">Book Your Service</h2>
                <p className="text-blue-100 text-lg">Complete your booking in just a few steps</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <Star className="h-4 w-4 text-yellow-300" />
                <span className="text-sm font-medium">Quick & Easy Setup</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <Shield className="h-4 w-4 text-green-300" />
                <span className="text-sm font-medium">Secure & Protected</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-10">
          {/* Customer Information Section */}
          <div className="space-y-8">
            <div className="flex items-center space-x-4 pb-4 border-b border-gray-100">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Your Information</h3>
                <p className="text-gray-500 mt-1">Let us know how to reach you</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="customerName" className="text-base font-semibold text-gray-800 flex items-center space-x-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <span>Full Name</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Enter your full name"
                  className="h-14 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="customerEmail" className="text-base font-semibold text-gray-800 flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <span>Email Address</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="your.email@example.com"
                  className="h-14 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="customerPhone" className="text-base font-semibold text-gray-800 flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-blue-600" />
                  <span>Phone Number</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="h-14 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white"
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
                  className="[&_label]:text-base [&_label]:font-semibold [&_label]:text-gray-800 [&_label]:flex [&_label]:items-center [&_label]:space-x-2 [&_input]:h-14 [&_input]:text-base [&_input]:border-2 [&_input]:border-gray-200 [&_input]:focus:border-blue-500 [&_input]:rounded-xl [&_input]:bg-gray-50/50 [&_input]:hover:bg-white [&_input]:focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Service Location Section */}
          <div className="space-y-8">
            <div className="flex items-center space-x-4 pb-4 border-b border-gray-100">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-md">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Service Location</h3>
                <p className="text-gray-500 mt-1">Where should we come to help you?</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <Label htmlFor="address" className="text-base font-semibold text-gray-800 flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <span>Complete Service Address</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street, Apartment 4B, City, State"
                  className="h-14 text-base border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label htmlFor="city" className="text-base font-semibold text-gray-800">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="h-14 text-base border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="region" className="text-base font-semibold text-gray-800">
                    Service Region <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={formData.region} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}
                  >
                    <SelectTrigger className="h-14 text-base border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white">
                      <SelectValue placeholder="Select your area" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2 bg-white shadow-xl">
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
                <Label htmlFor="specialInstructions" className="text-base font-semibold text-gray-800">
                  Special Instructions (Optional)
                </Label>
                <Textarea
                  id="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Any special instructions, access codes, parking info, or specific requests..."
                  className="min-h-[120px] text-base border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl resize-none transition-all duration-200 bg-gray-50/50 hover:bg-white focus:bg-white"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="flex justify-center pt-6">
            <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-full px-6 py-3 shadow-sm">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Your information is secure and encrypted</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-8">
            <Button 
              type="submit"
              className="w-full h-16 text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100"
              disabled={!isFormValid}
            >
              <span>Continue to Schedule</span>
              <ArrowRight className="h-6 w-6 ml-3" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
