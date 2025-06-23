
import React, { useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SecurePaymentForm } from '@/components/payment/SecurePaymentForm';

interface BookingData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  specialInstructions: string;
  date: string;
  time: string;
  address: string;
  city: string;
}

interface ContactFormProps {
  bookingData: BookingData;
  onUpdateBookingData: (updates: Partial<BookingData>) => void;
  onBack: () => void;
  onSubmit: (bookingId?: string) => void;
  getTotalPrice: () => number;
}

export const ContactForm = ({ 
  bookingData, 
  onUpdateBookingData, 
  onBack, 
  onSubmit, 
  getTotalPrice 
}: ContactFormProps) => {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const handleContactSubmit = async () => {
    // Validate required fields
    if (!bookingData.customerName || !bookingData.customerEmail || !bookingData.customerPhone) {
      alert('Please fill in all required fields');
      return;
    }

    // Here you would create the booking and get the bookingId
    // For now, we'll simulate this
    const simulatedBookingId = `booking_${Date.now()}`;
    setBookingId(simulatedBookingId);
    setShowPaymentForm(true);
  };

  const handlePaymentSuccess = () => {
    onSubmit(bookingId || undefined);
  };

  const handlePaymentFailure = (error: string) => {
    console.error('Payment failed:', error);
    alert(`Payment setup failed: ${error}`);
  };

  if (showPaymentForm) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-black">Secure Payment Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <SecurePaymentForm
              amount={getTotalPrice()}
              bookingId={bookingId || undefined}
              customerEmail={bookingData.customerEmail}
              customerName={bookingData.customerName}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentFailure={handlePaymentFailure}
              collectOnly={true} // Only collect payment method, don't charge
            />
            <div className="mt-4">
              <Button variant="outline" onClick={() => setShowPaymentForm(false)} className="w-full">
                Back to Contact Information
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-black">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-black">Full Name *</Label>
            <Input
              id="name"
              value={bookingData.customerName}
              onChange={(e) => onUpdateBookingData({ customerName: e.target.value })}
              placeholder="John Smith"
              className="bg-slate-700 border-slate-600 text-black"
              required
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-black">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={bookingData.customerEmail}
              onChange={(e) => onUpdateBookingData({ customerEmail: e.target.value })}
              placeholder="john@example.com"
              className="bg-slate-700 border-slate-600 text-black"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-black">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={bookingData.customerPhone}
              onChange={(e) => onUpdateBookingData({ customerPhone: e.target.value })}
              placeholder="(555) 123-4567"
              className="bg-slate-700 border-slate-600 text-black"
              required
            />
          </div>

          <div>
            <Label htmlFor="instructions" className="text-black">Special Instructions</Label>
            <Textarea
              id="instructions"
              value={bookingData.specialInstructions}
              onChange={(e) => onUpdateBookingData({ specialInstructions: e.target.value })}
              placeholder="Any special instructions for our technician..."
              className="bg-slate-700 border-slate-600 text-black"
            />
          </div>

          <div className="bg-slate-700/50 p-4 rounded-lg">
            <h3 className="text-black font-medium mb-2">Booking Summary</h3>
            <div className="space-y-2 text-slate-300">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>{new Date(bookingData.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })} at {new Date(`2000-01-01T${bookingData.time}`).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>{bookingData.address}, {bookingData.city}</span>
              </div>
              <div className="border-t border-slate-600 pt-2 mt-2">
                <div className="flex justify-between text-black font-medium">
                  <span>Estimated Total: ${getTotalPrice()}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Final amount will be charged by technician after service
                </p>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button onClick={handleContactSubmit} className="flex-1">
              Continue to Payment Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
