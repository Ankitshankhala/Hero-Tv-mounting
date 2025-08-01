
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Calendar, MapPin, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const BookingSuccess = () => {
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId }
        });

        if (error) {
          throw error;
        }

        if (data?.success) {
          setBooking(data.booking);
          toast({
            title: "Payment Successful!",
            description: "Your booking has been confirmed. We'll contact you soon.",
          });
        } else {
          toast({
            title: "Payment Issue",
            description: "There was an issue with your payment. Please contact us.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        toast({
          title: "Verification Error",
          description: "Could not verify payment status. Please contact us.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-white">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (!sessionId || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 p-8 max-w-md">
          <CardContent className="text-center">
            <h2 className="text-xl font-bold text-white mb-4">Booking Not Found</h2>
            <p className="text-slate-300 mb-4">
              We couldn't find your booking. Please check your email for confirmation details.
            </p>
            <Link to="/">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scheduledDate = new Date(booking.scheduled_at);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Payment Authorized!</h1>
            <p className="text-slate-300 text-lg">
              Thank you for choosing Hero TV Mounting. Your payment is authorized and booking is confirmed.
            </p>
        </div>

        {/* Booking Details */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Service Date & Time</p>
                <p className="text-slate-300">
                  {scheduledDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} at {scheduledDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Service Address</p>
                <p className="text-slate-300">{booking.customer_address}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Estimated Duration</p>
                <p className="text-slate-300">{booking.total_duration_minutes} minutes</p>
              </div>
            </div>

            <div className="bg-slate-700 p-4 rounded-lg">
              <p className="text-white font-medium mb-2">Services Booked:</p>
              {Array.isArray(booking.services) && booking.services.map((service: any, index: number) => (
                <div key={index} className="flex justify-between items-center py-1">
                  <span className="text-slate-300">{service.name} (x{service.quantity})</span>
                  <span className="text-white">${(service.price * service.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-slate-600 mt-2 pt-2">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-white">Total Authorized:</span>
                  <span className="text-blue-400">${booking.total_price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {booking.special_instructions && (
              <div>
                <p className="text-white font-medium">Special Instructions:</p>
                <p className="text-slate-300">{booking.special_instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">What's Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start space-x-2">
                <span className="text-blue-400">1.</span>
                <span>You'll receive a confirmation email with all the details</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400">2.</span>
                <span>Our team will contact you 24-48 hours before your appointment</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400">3.</span>
                <span>Our professional technician will arrive at your scheduled time</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400">4.</span>
                <span>Payment will be charged after service completion</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-400">5.</span>
                <span>Enjoy your perfectly mounted TV!</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardContent className="text-center py-6">
            <p className="text-white mb-2">Need to make changes or have questions?</p>
            <p className="text-slate-300 mb-4">Contact us at:</p>
            <a 
              href="tel:+17372729971"
              className="text-blue-400 hover:text-blue-300 text-xl font-semibold"
            >
              +1 737-272-9971
            </a>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/" className="flex-1">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return Home
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="flex-1 border-slate-600 text-white hover:bg-slate-700"
            onClick={() => window.print()}
          >
            Print Confirmation
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccess;
