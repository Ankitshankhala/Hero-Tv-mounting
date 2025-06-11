
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useZipcodeSearch } from '@/hooks/useZipcodeSearch';

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
  const { searchZipcode, isLoading, error } = useZipcodeSearch({
    onLocationFound: (city: string, region: string) => {
      onUpdateBookingData({ city, region });
    }
  });

  const handleZipcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const zipcode = e.target.value;
    onUpdateBookingData({ zipcode });
    
    // Trigger zipcode lookup
    searchZipcode(zipcode);
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
            <div>
              <Label htmlFor="zipcode" className="text-white">Zipcode *</Label>
              <div className="relative">
                <Input
                  id="zipcode"
                  value={bookingData.zipcode}
                  onChange={handleZipcodeChange}
                  placeholder="12345"
                  className="bg-slate-700 border-slate-600 text-white"
                  maxLength={5}
                />
                {isLoading && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
              {error && (
                <p className="text-red-400 text-sm mt-1">{error}</p>
              )}
              <p className="text-slate-400 text-xs mt-1">City will auto-fill when you enter a valid zipcode</p>
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
