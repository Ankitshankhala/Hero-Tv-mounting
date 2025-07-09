
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';
import { User, Mail, Phone, MapPin, ArrowLeft, ArrowRight, Star, Shield } from 'lucide-react';

interface BookingData {
  address: string;
  city: string;
  region: string;
  zipcode: string;
  specialInstructions: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

interface CustomerLocationFormProps {
  bookingData: BookingData;
  onUpdateBookingData: (updates: Partial<BookingData>) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const CustomerLocationForm = ({ bookingData, onUpdateBookingData, onBack, onContinue }: CustomerLocationFormProps) => {
  const handleZipcodeChange = (zipcode: string, cityState?: string) => {
    onUpdateBookingData({ zipcode });
    
    if (cityState) {
      const [city, state] = cityState.split(', ');
      onUpdateBookingData({ 
        city: city || bookingData.city,
        region: bookingData.region || 'downtown'
      });
    }
  };

  const isFormValid = 
    bookingData.customerName && 
    bookingData.customerEmail && 
    bookingData.customerPhone &&
    bookingData.address && 
    bookingData.city && 
    bookingData.region && 
    bookingData.zipcode;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600/10 to-purple-600/10 backdrop-blur-sm border border-blue-200 rounded-full px-6 py-2 mb-4">
            <Star className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Step 2 of 3</span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Contact & Location Details
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Help us connect with you and prepare for your service visit
          </p>
        </div>

        {/* Customer Information Card */}
        <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-xl shadow-blue-500/10 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8">
            <CardTitle className="text-2xl font-bold flex items-center space-x-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <User className="h-6 w-6" />
              </div>
              <span>Your Information</span>
            </CardTitle>
            <p className="text-blue-100 mt-2">We'll use this to contact you about your service</p>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="customerName" className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <span>Full Name</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerName"
                  value={bookingData.customerName}
                  onChange={(e) => onUpdateBookingData({ customerName: e.target.value })}
                  placeholder="Enter your full name"
                  className="h-14 text-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl bg-gray-50/50 transition-all duration-200"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="customerEmail" className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <span>Email Address</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={bookingData.customerEmail}
                  onChange={(e) => onUpdateBookingData({ customerEmail: e.target.value })}
                  placeholder="your.email@example.com"
                  className="h-14 text-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl bg-gray-50/50 transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="customerPhone" className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-blue-600" />
                  <span>Phone Number</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={bookingData.customerPhone}
                  onChange={(e) => onUpdateBookingData({ customerPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="h-14 text-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-xl bg-gray-50/50 transition-all duration-200"
                />
              </div>
              <div className="space-y-3">
                <ZipcodeInput
                  id="zipcode"
                  label="ZIP Code"
                  value={bookingData.zipcode}
                  onChange={handleZipcodeChange}
                  required
                  placeholder="12345"
                  className="[&_label]:text-lg [&_label]:font-semibold [&_label]:text-gray-800 [&_label]:flex [&_label]:items-center [&_label]:space-x-2 [&_input]:h-14 [&_input]:text-lg [&_input]:border-2 [&_input]:border-gray-200 [&_input]:focus:border-blue-500 [&_input]:rounded-xl [&_input]:bg-gray-50/50"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="address" className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-green-600" />
                <span>Complete Service Address</span>
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="address"
                value={bookingData.address}
                onChange={(e) => onUpdateBookingData({ address: e.target.value })}
                placeholder="123 Main Street, Apartment 4B"
                className="h-14 text-lg border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl bg-gray-50/50 transition-all duration-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Service Location Card */}
        <Card className="bg-white/80 backdrop-blur-xl border-0 shadow-xl shadow-green-500/10 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-8">
            <CardTitle className="text-2xl font-bold flex items-center space-x-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <MapPin className="h-6 w-6" />
              </div>
              <span>Service Location</span>
            </CardTitle>
            <p className="text-green-100 mt-2">Where should our technician visit?</p>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="city" className="text-lg font-semibold text-gray-800">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="city"
                  value={bookingData.city}
                  onChange={(e) => onUpdateBookingData({ city: e.target.value })}
                  placeholder="Your city"
                  className="h-14 text-lg border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl bg-gray-50/50 transition-all duration-200"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="region" className="text-lg font-semibold text-gray-800">
                  Service Region <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={bookingData.region} 
                  onValueChange={(value) => onUpdateBookingData({ region: value })}
                >
                  <SelectTrigger className="h-14 text-lg border-2 border-gray-200 focus:border-green-500 rounded-xl bg-gray-50/50 transition-all duration-200">
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
              <Label htmlFor="specialInstructions" className="text-lg font-semibold text-gray-800">
                Special Instructions (Optional)
              </Label>
              <Textarea
                id="specialInstructions"
                value={bookingData.specialInstructions}
                onChange={(e) => onUpdateBookingData({ specialInstructions: e.target.value })}
                placeholder="Any special instructions, access codes, parking info, or specific requests for our technician..."
                className="min-h-[120px] text-black text-lg border-2 border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl bg-gray-50/50 resize-none transition-all duration-200"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200 rounded-full px-6 py-3">
            <Shield className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Your information is secure and encrypted</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-8">
          <Button 
            variant="outline" 
            onClick={onBack} 
            className="flex-1 h-16 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 rounded-xl transition-all duration-200 bg-white/80 backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Services
          </Button>
          <Button 
            onClick={onContinue} 
            className="flex-1 h-16 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            disabled={!isFormValid}
          >
            Continue to Schedule
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
