
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { X, MapPin, Clock, User, Mail, Phone, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { StripeCardElement } from '@/components/StripeCardElement';
import type { CartItem } from '@/pages/Index';

interface EmbeddedCheckoutProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmbeddedCheckout = ({ cart, total, onClose, onSuccess }: EmbeddedCheckoutProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    zipcode: '',
    date: '',
    time: '',
    specialInstructions: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'payment'>('details');
  const [stripe, setStripe] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [cardError, setCardError] = useState<string>('');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const calculateTotalDuration = () => {
    return cart.reduce((total, item) => {
      let baseDuration = 60;
      if (item.options?.numberOfTvs && item.options.numberOfTvs > 1) {
        baseDuration += (item.options.numberOfTvs - 1) * 30;
      }
      if (item.options?.cableConcealment === 'in-wall') {
        baseDuration += 45;
      }
      return total + (baseDuration * item.quantity);
    }, 0);
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.date || !formData.time) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setPaymentStep('payment');
  };

  const handleStripeReady = (stripeInstance: any, elements: any, cardElementInstance: any) => {
    setStripe(stripeInstance);
    setCardElement(cardElementInstance);
  };

  const handleCardError = (error: string) => {
    setCardError(error);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !cardElement) {
      toast({
        title: "Payment Error",
        description: "Payment system is not ready. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setCardError('');

    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00`).toISOString();
      
      const bookingData = {
        address: formData.address,
        scheduledAt,
        services: cart,
        totalPrice: total,
        totalDuration: calculateTotalDuration(),
        specialInstructions: formData.specialInstructions,
        zipcode: formData.zipcode,
        latitude: null,
        longitude: null
      };

      // Create payment intent
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          bookingData,
          customerEmail: formData.email,
          customerName: formData.name
        }
      });

      if (error) throw error;

      // Confirm payment with card
      const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: formData.name,
            email: formData.email,
          },
        }
      });

      if (confirmError) {
        setCardError(confirmError.message);
        return;
      }

      toast({
        title: "Payment Successful",
        description: "Your booking has been confirmed!",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {paymentStep === 'details' ? 'Book Your Service' : 'Payment Details'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {paymentStep === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="p-6 space-y-6">
            {/* Service Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Service Summary</h3>
              {cart.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <span className="text-gray-700">{item.name} (x{item.quantity})</span>
                  <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Full Name *</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>Email *</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>Phone Number *</span>
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="zipcode">ZIP Code</Label>
                <Input
                  id="zipcode"
                  name="zipcode"
                  value={formData.zipcode}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Service Address */}
            <div>
              <Label htmlFor="address" className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Service Address *</span>
              </Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Enter full address where service will be performed"
                required
                className="mt-1"
              />
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date" className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Preferred Date *</span>
                </Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="time">Preferred Time *</Label>
                <Input
                  id="time"
                  name="time"
                  type="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                name="specialInstructions"
                value={formData.specialInstructions}
                onChange={handleInputChange}
                placeholder="Any special instructions for our technician..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex space-x-4 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Continue to Payment
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="px-8"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {paymentStep === 'payment' && (
          <div className="p-6 space-y-6">
            {/* Order Summary */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Order Summary</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Customer: {formData.name}</div>
                <div>Service Date: {formData.date} at {formData.time}</div>
                <div>Address: {formData.address}</div>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              {/* Payment Method */}
              <div>
                <Label className="flex items-center space-x-2 mb-3">
                  <CreditCard className="h-4 w-4" />
                  <span>Payment Method</span>
                </Label>
                <Card className="p-4">
                  <StripeCardElement
                    onReady={handleStripeReady}
                    onError={handleCardError}
                  />
                  {cardError && (
                    <div className="text-red-500 text-sm mt-2">{cardError}</div>
                  )}
                </Card>
              </div>

              <div className="flex space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentStep('details')}
                  className="flex-1"
                >
                  Back to Details
                </Button>
                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isProcessing ? 'Processing...' : `Pay $${total.toFixed(2)}`}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
