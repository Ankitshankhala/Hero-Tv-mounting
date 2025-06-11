
import React, { useState } from 'react';
import { CustomerLocationForm } from './booking/CustomerLocationForm';
import { CalendarView } from './booking/CalendarView';
import { BookingConfirmation } from './booking/BookingConfirmation';
import { CartItem } from '@/pages/Index';

interface InlineBookingFlowProps {
  cart: CartItem[];
  onClose: () => void;
}

export const InlineBookingFlow = ({ cart, onClose }: InlineBookingFlowProps) => {
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    address: '',
    city: '',
    region: '',
    zipcode: '',
    specialInstructions: '',
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  });

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleBookingSubmit = () => {
    console.log('Booking submitted:', { cart, bookingData, total: getTotalPrice() });
    setStep(3);
  };

  const handleDateTimeSelect = (date: string, time: string) => {
    setBookingData(prev => ({
      ...prev,
      date,
      time
    }));
  };

  const updateBookingData = (updates: Partial<typeof bookingData>) => {
    setBookingData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Complete Your Booking</h2>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {step === 1 && (
              <CustomerLocationForm
                bookingData={bookingData}
                onUpdateBookingData={updateBookingData}
                onBack={onClose}
                onContinue={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <CalendarView
                selectedRegion={bookingData.region}
                selectedDate={bookingData.date}
                selectedTime={bookingData.time}
                onDateTimeSelect={handleDateTimeSelect}
                onBack={() => setStep(1)}
                onContinue={handleBookingSubmit}
              />
            )}

            {step === 3 && <BookingConfirmation />}
          </div>
        </div>
      </div>
    </div>
  );
};
