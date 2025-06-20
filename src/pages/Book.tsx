import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarView } from '@/components/booking/CalendarView';
import { BookingProgress } from '@/components/booking/BookingProgress';
import { ServiceSelection } from '@/components/booking/ServiceSelection';
import { CustomerLocationForm } from '@/components/booking/CustomerLocationForm';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { CartItem } from '@/types';

const Book = () => {
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
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

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + item.quantity, options: item.options || i.options }
            : i
        );
      } else {
        return [...prev, item];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleBookingSubmit = () => {
    console.log('Booking submitted:', { cart, bookingData, total: getTotalPrice() });
    // TODO: Integrate with Supabase
    setStep(4);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" className="text-white hover:text-blue-400">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-white">Book Your Service</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <BookingProgress currentStep={step} />

        {step === 1 && (
          <ServiceSelection
            cart={cart}
            onAddToCart={addToCart}
            onContinue={() => setStep(2)}
            getTotalPrice={getTotalPrice}
          />
        )}

        {step === 2 && (
          <CustomerLocationForm
            bookingData={bookingData}
            onUpdateBookingData={updateBookingData}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <CalendarView
            selectedRegion={bookingData.region}
            selectedDate={bookingData.date}
            selectedTime={bookingData.time}
            onDateTimeSelect={handleDateTimeSelect}
            onBack={() => setStep(2)}
            onContinue={handleBookingSubmit}
          />
        )}

        {step === 4 && <BookingConfirmation />}
      </div>
    </div>
  );
};

export default Book;
