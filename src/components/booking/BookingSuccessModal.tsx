
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, CalendarIcon, CreditCard, Trophy, Heart, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FormData {
  selectedDate: Date | undefined;
  selectedTime: string;
}

interface BookingSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  successAnimation: boolean;
  formData: FormData;
  getTotalPrice: () => number;
  bookingId: string;
}

export const BookingSuccessModal = ({
  isOpen,
  onClose,
  successAnimation,
  formData,
  getTotalPrice,
  bookingId
}: BookingSuccessModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={cn(
        "bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden",
        "transform transition-all duration-700 ease-out",
        successAnimation ? "scale-100 opacity-100" : "scale-95 opacity-90"
      )}>
        {/* Success Header with Gradient */}
        <div className="bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="relative z-10 text-center">
            <div className={cn(
              "w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6",
              "transform transition-all duration-1000 delay-300",
              successAnimation ? "scale-100 rotate-0" : "scale-0 rotate-180"
            )}>
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            
            <div className={cn(
              "transform transition-all duration-700 delay-500",
              successAnimation ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}>
              <h2 className="text-3xl font-bold mb-2">Booking Confirmed!</h2>
              <div className="flex items-center justify-center space-x-2 text-green-100">
                <Sparkles className="h-5 w-5" />
                <span className="text-lg">Payment Successful</span>
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Success Content */}
        <div className="p-8">
          <div className={cn(
            "transform transition-all duration-700 delay-700",
            successAnimation ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}>
            {/* Booking Summary */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Scheduled Date</p>
                    <p className="text-sm text-gray-600">
                      {formData.selectedDate && format(formData.selectedDate, 'EEEE, MMMM do, yyyy')} at {formData.selectedTime}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Total Amount</p>
                    <p className="text-sm text-gray-600">${getTotalPrice()}</p>
                  </div>
                </div>
                <div className="text-green-600 font-bold text-lg">${getTotalPrice()}</div>
              </div>
            </div>

            {/* What's Next */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center space-x-3 mb-4">
                <Trophy className="h-6 w-6 text-blue-600" />
                <h3 className="font-semibold text-blue-900">What's Next?</h3>
              </div>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span>We'll contact you within 24 hours to confirm details</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span>A qualified technician will be assigned to your job</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span>You'll receive SMS updates about your appointment</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <Button 
                onClick={onClose} 
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Heart className="h-4 w-4 mr-2" />
                Awesome, Thanks!
              </Button>
            </div>

            {/* Footer Note */}
            <p className="text-center text-xs text-gray-500 mt-4">
              Booking ID: {bookingId?.slice(0, 8)}... • Auto-closing in 5 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
