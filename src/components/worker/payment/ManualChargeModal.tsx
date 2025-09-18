
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, CreditCard, Shield, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ManualChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  onChargeComplete: () => void;
}

interface ServiceModification {
  id: string;
  type: 'addition' | 'removal';
  serviceName: string;
  priceChange: number;
  description: string;
}

export const ManualChargeModal = ({ isOpen, onClose, booking, onChargeComplete }: ManualChargeModalProps) => {
  const [loading, setLoading] = useState(false);
  const [serviceModifications, setServiceModifications] = useState<ServiceModification[]>([]);
  const [chargeType, setChargeType] = useState<'service_modification' | 'late_fee' | 'additional_service'>('service_modification');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethodInfo, setPaymentMethodInfo] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && booking) {
      fetchPaymentMethodInfo();
    }
  }, [isOpen, booking]);

  const fetchPaymentMethodInfo = async () => {
    if (!booking?.stripe_payment_method_id) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-payment-method-info', {
        body: { paymentMethodId: booking.stripe_payment_method_id }
      });

      if (error) throw error;
      setPaymentMethodInfo(data);
    } catch (error) {
      console.error('Error fetching payment method:', error);
    }
  };

  const addServiceModification = () => {
    const newMod: ServiceModification = {
      id: `mod_${Date.now()}`,
      type: 'addition',
      serviceName: '',
      priceChange: 0,
      description: ''
    };
    setServiceModifications([...serviceModifications, newMod]);
  };

  const updateServiceModification = (id: string, field: keyof ServiceModification, value: any) => {
    setServiceModifications(prev => 
      prev.map(mod => mod.id === id ? { ...mod, [field]: value } : mod)
    );
  };

  const removeServiceModification = (id: string) => {
    setServiceModifications(prev => prev.filter(mod => mod.id !== id));
  };

  const calculateTotalAmount = () => {
    if (chargeType === 'service_modification') {
      return serviceModifications.reduce((total, mod) => {
        return total + (mod.type === 'addition' ? mod.priceChange : -mod.priceChange);
      }, 0);
    }
    return parseFloat(amount) || 0;
  };

  const handleManualCharge = async () => {
    if (!booking?.stripe_customer_id || !booking?.stripe_payment_method_id) {
      toast({
        title: "Error",
        description: "No payment method found for this booking",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = calculateTotalAmount();
    if (totalAmount <= 0) {
      toast({
        title: "Error",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Service modifications are no longer stored in separate table
      // Modifications are tracked via description field only

      // CRITICAL FIX: Send amount in dollars, not cents
      // The edge function will handle the cent conversion
      const { data, error } = await supabase.functions.invoke('process-manual-charge', {
        body: {
          bookingId: booking.id,
          customerId: booking.stripe_customer_id,
          paymentMethodId: booking.stripe_payment_method_id,
          amount: totalAmount, // Send in dollars, NOT cents  
          chargeType,
          description: description || `Manual charge for booking ${booking.id}`
        }
      });

      if (error) throw error;

      // Manual charges are now tracked via transactions table only
      // The edge function creates the transaction record

      toast({
        title: "Charge Successful",
        description: `Successfully charged $${totalAmount.toFixed(2)} to customer's card`,
      });

      onChargeComplete();
      onClose();
    } catch (error) {
      console.error('Error processing manual charge:', error);
      toast({
        title: "Charge Failed",
        description: "Failed to process charge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Manual Charge</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Payment Method Info */}
          {paymentMethodInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Payment Method</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span>•••• •••• •••• {paymentMethodInfo.last4}</span>
                  <span className="text-gray-500">({paymentMethodInfo.brand?.toUpperCase()})</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charge Type Selection */}
          <div>
            <Label htmlFor="chargeType">Charge Type</Label>
            <Select value={chargeType} onValueChange={(value: any) => setChargeType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service_modification">Service Modifications</SelectItem>
                <SelectItem value="additional_service">Additional Service</SelectItem>
                <SelectItem value="late_fee">Late Cancellation Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Modifications */}
          {chargeType === 'service_modification' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Service Modifications</Label>
                <Button type="button" variant="outline" size="sm" onClick={addServiceModification}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>
              
              {serviceModifications.map((mod) => (
                <Card key={mod.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="grid grid-cols-2 gap-3 flex-1">
                        <div>
                          <Label>Type</Label>
                          <Select 
                            value={mod.type} 
                            onValueChange={(value: 'addition' | 'removal') => 
                              updateServiceModification(mod.id, 'type', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="addition">Addition (+)</SelectItem>
                              <SelectItem value="removal">Removal (-)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={mod.priceChange}
                            onChange={(e) => 
                              updateServiceModification(mod.id, 'priceChange', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeServiceModification(mod.id)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div>
                      <Label>Service Name</Label>
                      <Input
                        value={mod.serviceName}
                        onChange={(e) => 
                          updateServiceModification(mod.id, 'serviceName', e.target.value)
                        }
                        placeholder="e.g., Additional TV mounting"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={mod.description}
                        onChange={(e) => 
                          updateServiceModification(mod.id, 'description', e.target.value)
                        }
                        placeholder="Optional description"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Fixed Amount for other charge types */}
          {chargeType !== 'service_modification' && (
            <div>
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the charge..."
            />
          </div>

          {/* Total Amount Display */}
          <Alert>
            <AlertDescription>
              <strong>Total Charge: ${calculateTotalAmount().toFixed(2)}</strong>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleManualCharge}
              disabled={loading || calculateTotalAmount() <= 0}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Processing...' : `Charge $${calculateTotalAmount().toFixed(2)}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
