
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZipcodeInput } from '@/components/ui/ZipcodeInput';

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
    
    // Auto-fill city and region if zipcode validation provides it
    if (cityState) {
      const [city, state] = cityState.split(', ');
      onUpdateBookingData({ 
        city: city || bookingData.city,
        region: bookingData.region || 'downtown' // Default region
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
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Customer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName" className="text-white">Full Name *</Label>
              <Input
                id="customerName"
                value={bookingData.customerName}
                onChange={(e) => onUpdateBookingData({ customerName: e.target.value })}
                placeholder="John Doe"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="customerEmail" className="text-white">Email *</Label>
              <Input
                id="customerEmail"
                type="email"
                value={bookingData.customerEmail}
                onChange={(e) => onUpdateBookingData({ customerEmail: e.target.value })}
                placeholder="john@example.com"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="customerPhone" className="text-white">Phone Number *</Label>
            <Input
              id="customerPhone"
              type="tel"
              value={bookingData.customerPhone}
              onChange={(e) => onUpdateBookingData({ customerPhone: e.target.value })}
              placeholder="(555) 123-4567"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Service Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address" className="text-white">Service Address *</Label>
            <Input
              id="address"
              value={bookingData.address}
              onChange={(e) => onUpdateBookingData({ address: e.target.value })}
              placeholder="123 Main Street"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <ZipcodeInput
                id="zipcode"
                label="Zipcode"
                value={bookingData.zipcode}
                onChange={handleZipcodeChange}
                required
                placeholder="12345"
                className="[&_label]:text-white [&_input]:bg-slate-700 [&_input]:border-slate-600 [&_input]:text-white"
              />
            </div>
            <div>
              <Label htmlFor="city" className="text-white">City *</Label>
              <Input
                id="city"
                value={bookingData.city}
                onChange={(e) => onUpdateBookingData({ city: e.target.value })}
                placeholder="Your city"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="region" className="text-white">Region *</Label>
              <Select 
                value={bookingData.region} 
                onValueChange={(value) => onUpdateBookingData({ region: value })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Select region" />
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

          <div>
            <Label htmlFor="specialInstructions" className="text-white">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              value={bookingData.specialInstructions}
              onChange={(e) => onUpdateBookingData({ specialInstructions: e.target.value })}
              placeholder="Any special instructions for the technician..."
              className="bg-slate-700 border-slate-600 text-white"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex space-x-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button 
          onClick={onContinue} 
          className="flex-1"
          disabled={!isFormValid}
        >
          Continue to Schedule
        </Button>
      </div>
    </div>
  );
};
