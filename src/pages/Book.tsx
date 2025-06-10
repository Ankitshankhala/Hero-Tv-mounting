
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServicesSection } from '@/components/ServicesSection';
import { CartItem } from './Index';

const Book = () => {
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    address: '',
    city: '',
    region: '',
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
        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= i ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {i}
                </div>
                {i < 4 && <div className={`w-12 h-1 ${step > i ? 'bg-blue-600' : 'bg-slate-700'}`} />}
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Select Your Services</h2>
              <p className="text-slate-300">Choose the services you need</p>
            </div>
            <ServicesSection onAddToCart={addToCart} />
            
            {cart.length > 0 && (
              <div className="mt-8 max-w-md mx-auto">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Your Selection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-white">
                        <span>{item.name} (x{item.quantity})</span>
                        <span>${item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-600 pt-4">
                      <div className="flex justify-between items-center text-lg font-bold text-white">
                        <span>Total: ${getTotalPrice()}</span>
                      </div>
                    </div>
                    <Button onClick={() => setStep(2)} className="w-full">
                      Continue to Details
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date" className="text-white">Preferred Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={bookingData.date}
                      onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time" className="text-white">Preferred Time</Label>
                    <Select value={bookingData.time} onValueChange={(value) => setBookingData({...bookingData, time: value})}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9:00">9:00 AM</SelectItem>
                        <SelectItem value="11:00">11:00 AM</SelectItem>
                        <SelectItem value="13:00">1:00 PM</SelectItem>
                        <SelectItem value="15:00">3:00 PM</SelectItem>
                        <SelectItem value="17:00">5:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="text-white">Service Address</Label>
                  <Input
                    id="address"
                    value={bookingData.address}
                    onChange={(e) => setBookingData({...bookingData, address: e.target.value})}
                    placeholder="123 Main Street"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city" className="text-white">City</Label>
                    <Input
                      id="city"
                      value={bookingData.city}
                      onChange={(e) => setBookingData({...bookingData, city: e.target.value})}
                      placeholder="Your city"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="region" className="text-white">Region</Label>
                    <Select value={bookingData.region} onValueChange={(value) => setBookingData({...bookingData, region: value})}>
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
                  <Label htmlFor="instructions" className="text-white">Special Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={bookingData.specialInstructions}
                    onChange={(e) => setBookingData({...bookingData, specialInstructions: e.target.value})}
                    placeholder="Any special instructions for our technician..."
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="flex space-x-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)} className="flex-1">
                    Continue to Contact Info
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-white">Full Name</Label>
                  <Input
                    id="name"
                    value={bookingData.customerName}
                    onChange={(e) => setBookingData({...bookingData, customerName: e.target.value})}
                    placeholder="John Smith"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={bookingData.customerEmail}
                    onChange={(e) => setBookingData({...bookingData, customerEmail: e.target.value})}
                    placeholder="john@example.com"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-white">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={bookingData.customerPhone}
                    onChange={(e) => setBookingData({...bookingData, customerPhone: e.target.value})}
                    placeholder="(555) 123-4567"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <h3 className="text-white font-medium mb-2">Booking Summary</h3>
                  <div className="space-y-2 text-slate-300">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>{bookingData.date} at {bookingData.time}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>{bookingData.address}, {bookingData.city}</span>
                    </div>
                    <div className="border-t border-slate-600 pt-2 mt-2">
                      <div className="flex justify-between text-white font-medium">
                        <span>Total: ${getTotalPrice()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleBookingSubmit} className="flex-1">
                    Confirm Booking
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && (
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
        )}
      </div>
    </div>
  );
};

export default Book;
