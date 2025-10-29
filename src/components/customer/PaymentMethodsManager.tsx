import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Trash2, Calendar, Plus } from 'lucide-react';
import { useSavedPaymentMethods } from '@/hooks/useSavedPaymentMethods';
import { useAuth } from '@/hooks/useAuth';

export const PaymentMethodsManager = () => {
  const { user } = useAuth();
  const { paymentMethod, loading, fetchPaymentMethod, removePaymentMethod } = useSavedPaymentMethods();

  useEffect(() => {
    if (user?.email) {
      fetchPaymentMethod(user.email);
    }
  }, [user?.email]);

  const handleRemove = async () => {
    if (paymentMethod && window.confirm('Are you sure you want to remove this payment method?')) {
      await removePaymentMethod(paymentMethod.id);
    }
  };

  if (loading && !paymentMethod) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <p className="text-slate-400">Loading payment methods...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>Payment Methods</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {paymentMethod && paymentMethod.stripe_default_payment_method_id ? (
          <div className="space-y-4">
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {paymentMethod.brand ? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1) : 'Card'} 
                      {' '}•••• {paymentMethod.last4 || '****'}
                    </p>
                    {paymentMethod.exp_month && paymentMethod.exp_year && (
                      <div className="flex items-center space-x-1 text-slate-400 text-sm mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  disabled={loading}
                  className="border-red-600 text-red-400 hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-700 p-3 rounded-lg">
              <p className="text-blue-200 text-sm">
                💳 This payment method can be charged by technicians for completed services
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-400 mb-4">No payment method saved</p>
            <p className="text-slate-500 text-sm mb-4">
              Payment methods are saved when you authorize a booking payment
            </p>
            <Button variant="outline" className="border-slate-600 text-slate-300">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
