
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-700"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="ghost" className="text-white hover:text-blue-300 hover:bg-white/10 transition-all duration-300">
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="h-8 w-px bg-white/30"></div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Book Your Service</h1>
                  <p className="text-blue-200 text-sm">Professional services at your doorstep</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Progress Section */}
        <div className="mb-12">
          <BookingProgress currentStep={step} />
        </div>

        {/* Content Sections with enhanced styling */}
        <div className="relative">
          {step === 1 && (
            <div className="animate-fade-in">
              <ServiceSelection
                cart={cart}
                onAddToCart={addToCart}
                onContinue={() => setStep(2)}
                getTotalPrice={getTotalPrice}
              />
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <CustomerLocationForm
                bookingData={bookingData}
                onUpdateBookingData={updateBookingData}
                onBack={() => setStep(1)}
                onContinue={() => setStep(3)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <CalendarView
                selectedRegion={bookingData.region}
                selectedDate={bookingData.date}
                selectedTime={bookingData.time}
                onDateTimeSelect={handleDateTimeSelect}
                onBack={() => setStep(2)}
                onContinue={handleBookingSubmit}
              />
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <BookingConfirmation />
            </div>
          )}
        </div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default Book;
