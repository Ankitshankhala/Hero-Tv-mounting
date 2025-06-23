
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const BookingConfirmation = () => {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="py-12">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Booking Confirmed!</h2>
          <p className="text-slate-300 mb-6">
            Thank you for your booking. We'll contact you shortly to confirm the details and assign a technician.
          </p>
          <div className="space-y-4">
            <Link to="/dashboard">
              <Button className="w-full">View My Bookings</Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">Back to Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
