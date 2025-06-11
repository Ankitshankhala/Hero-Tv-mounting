
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BookingData {
  address: string;
  city: string;
  region: string;
  zipcode: string;
}

interface LocationFormProps {
  bookingData: BookingData;
  onUpdateBookingData: (updates: Partial<BookingData>) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const LocationForm = ({ bookingData, onUpdateBookingData, onBack, onContinue }: LocationFormProps) => {
  const isFormValid = bookingData.address && bookingData.city && bookingData.region && bookingData.zipcode;

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Service Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="address" className="text-white">Service Address</Label>
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
              <Label htmlFor="city" className="text-white">City</Label>
              <Input
                id="city"
                value={bookingData.city}
                onChange={(e) => onUpdateBookingData({ city: e.target.value })}
                placeholder="Your city"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label htmlFor="region" className="text-white">Region</Label>
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
            <div>
              <Label htmlFor="zipcode" className="text-white">Zipcode</Label>
              <Input
                id="zipcode"
                value={bookingData.zipcode}
                onChange={(e) => onUpdateBookingData({ zipcode: e.target.value })}
                placeholder="12345"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>

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
        </CardContent>
      </Card>
    </div>
  );
};
