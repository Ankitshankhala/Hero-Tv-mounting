import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceCard } from '@/components/ServiceCard';
import { TvMountingModal } from '@/components/TvMountingModal';
import { InlineStripePaymentForm } from './payment/InlineStripePaymentForm';
import { PaymentVerificationForm } from './payment/PaymentVerificationForm';
import { ReauthorizePaymentDialog } from './payment/ReauthorizePaymentDialog';
import { CartItem } from '@/types';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTestingMode, getEffectiveServicePrice } from '@/contexts/TestingModeContext';
import { ShoppingCart, CreditCard, Plus, X, ArrowLeft } from 'lucide-react';

interface AddServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onServicesAdded?: () => void;
}

const getServiceImage = (serviceName: string) => {
  const imageMap: { [key: string]: string } = {
    'Mount TV': '/lovable-uploads/9b4cf239-a12b-4275-9ca2-a4abafb59c40.png',
    'Full Motion Mount': '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
    'Flat Mount': '/lovable-uploads/4a49b814-b16a-4daf-aa91-3a52fcbb5fae.png',
    'Cover Cables': '/lovable-uploads/6889f051-f5b1-4f2a-a093-a09693378bd4.png',
    'Simple Cable Concealment': '/lovable-uploads/cf56b4f9-cc16-4662-ba09-6186268ae1a0.png',
    'Fire Safe Cable Concealment': '/lovable-uploads/ebfd43c9-5c9d-4d15-b395-a22f44063cb6.png',
    'General Mounting': '/lovable-uploads/a5b8dff7-04c1-4590-a491-0d8a7f9d004c.png',
    'Furniture Assembly': '/lovable-uploads/fe916134-126d-4cff-aefa-608f842b536a.png',
    'Hire Second Technician': '/lovable-uploads/f430204b-2ef5-4727-b3ee-7f4d9d26ded4.png'
  };
  
  return imageMap[serviceName] || '/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png';
};

export const AddServicesModal = ({ isOpen, onClose, job, onServicesAdded }: AddServicesModalProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showTvModal, setShowTvModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReauthorizeDialog, setShowReauthorizeDialog] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    clientSecret: string;
    amount: number;
    paymentIntentId: string;
    sessionId?: string;
  } | null>(null);
  const [reauthorizeData, setReauthorizeData] = useState<{
    original_amount: number;
    new_amount: number;
    client_secret: string;
    old_payment_intent: string;
    new_payment_intent: string;
  } | null>(null);
  const { services, loading } = usePublicServicesData();
  const { toast } = useToast();
  const { isTestingMode } = useTestingMode();

  const handleServiceClick = (serviceId: string, serviceName: string) => {
    if (serviceName === 'Mount TV') {
      setShowTvModal(true);
    } else {
      // For other services, just add to cart
      const service = services.find(s => s.id === serviceId);
      if (service) {
        const effectivePrice = getEffectiveServicePrice(service.base_price, isTestingMode, cart.length);
        const serviceItem = {
          id: serviceId,
          name: serviceName,
          price: effectivePrice,
          quantity: 1
        };
        addToCart(serviceItem);
      }
    }
  };

  const addToCart = (item: CartItem) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, item];
    });

    toast({
      title: "Service Added",
      description: `${item.name} added to your selection`,
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCart(prevCart => 
      prevCart.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleTvMountingComplete = (cartItems: CartItem[]) => {
    cartItems.forEach(item => addToCart(item));
    setShowTvModal(false);
  };

  const handleAddServicesAndCharge = async () => {
    if (cart.length === 0) {
      toast({
        title: "No Services Selected",
        description: "Please select services to add to the booking",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      const totalAmount = getTotalPrice();
      
      // Calculate current booking amount
      const currentAmount = job.booking_services?.reduce((sum: number, bs: any) => 
        sum + (bs.base_price * bs.quantity), 0
      ) || job.service?.base_price || 0;

      // Use the new add-booking-services function that handles incremental authorization
      const { data, error } = await supabase.functions.invoke('add-booking-services', {
        body: {
          booking_id: job.id,
          testing_mode: isTestingMode,
          services: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            configuration: item.options || {}
          }))
        }
      });

      if (error) {
        console.error('Error adding services:', error);
        throw new Error('Failed to add services and update payment authorization');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to add services and update payment authorization');
      }

      // Check if card doesn't support increment and requires new payment
      if (data.requires_new_payment && data.client_secret) {
        toast({
          title: "Payment Re-authorization Required",
          description: "Your card doesn't support authorization updates. Please re-enter card details.",
        });

        // Show reauthorize payment dialog
        setReauthorizeData({
          original_amount: currentAmount,
          new_amount: data.new_amount,
          client_secret: data.client_secret,
          old_payment_intent: data.old_payment_intent,
          new_payment_intent: data.new_payment_intent
        });
        setShowReauthorizeDialog(true);
        setProcessing(false);
        return;
      }

      // Step 3: Mark job as completed
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', job.id);

      if (updateError) {
        console.error('Error marking job complete:', updateError);
        toast({
          title: "Services Added",
          description: "Services added but failed to mark job complete. Please use 'Mark Complete' button.",
          variant: "destructive",
        });
        setCart([]);
        onClose();
        onServicesAdded?.();
        return;
      }

      // Step 4: Refresh job data to get latest payment_intent_id
      const { data: refreshedJob, error: refreshError } = await supabase
        .from('bookings')
        .select('payment_intent_id')
        .eq('id', job.id)
        .single();

      if (refreshError) {
        console.error('[ADD-SERVICES] Failed to refresh job data:', refreshError);
      } else {
        console.log('[ADD-SERVICES] Using refreshed payment_intent_id:', refreshedJob?.payment_intent_id);
      }

      // Step 5: Capture the full payment amount
      if (job.payment_intent_id) {
        const { data: captureData, error: captureError } = await supabase.functions.invoke('capture-payment-intent', {
          body: { 
            booking_id: job.id  // Only send booking_id - edge function will fetch payment_intent_id
          }
        });

        if (captureError || !captureData?.success) {
          toast({
            title: "Services Added & Job Completed",
            description: "Payment capture failed. Use the Charge button to retry.",
            variant: "destructive",
          });
          setCart([]);
          onClose();
          onServicesAdded?.();
          return;
        }

        // Step 6: Explicitly archive the job after successful capture
        const { error: archiveError } = await supabase
          .from('bookings')
          .update({ 
            is_archived: true, 
            archived_at: new Date().toISOString() 
          })
          .eq('id', job.id);
        
        if (archiveError) {
          console.error('[ADD-SERVICES] Auto-archive failed:', archiveError);
          // Log but don't fail - trigger should handle it
        } else {
          console.log('[ADD-SERVICES] Job explicitly archived after capture');
        }

        // Complete success!
        toast({
          title: "Job Completed & Payment Captured",
          description: `Added ${cart.length} service(s) and charged full amount of $${data.new_amount.toFixed(2)}`,
        });
      } else {
        toast({
          title: "Job Completed",
          description: `Added ${cart.length} service(s) and marked job complete`,
        });
      }

      // Reset cart and close modal
      setCart([]);
      onClose();
      
      if (onServicesAdded) {
        onServicesAdded();
      }

    } catch (error) {
      console.error('Error adding services and charging:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add services",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast({
      title: "Payment Successful",
      description: `Successfully charged $${paymentData?.amount.toFixed(2)} for additional services`,
    });

    // Reset everything and close modal
    setCart([]);
    setShowPaymentForm(false);
    setPaymentData(null);
    onClose();
    
    if (onServicesAdded) {
      onServicesAdded();
    }
  };

  const handlePaymentFailure = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };

  const handleBackToServices = () => {
    setShowPaymentForm(false);
    setPaymentData(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:text-slate-300 [&>button]:hover:opacity-80">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center space-x-2">
              {showPaymentForm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToServices}
                  className="text-white hover:text-slate-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <span>
                {showPaymentForm ? 'Payment Required' : `Add Services to Job #${job.id.slice(0, 8)}`}
              </span>
              {isTestingMode && !showPaymentForm && (
                <Badge variant="secondary" className="bg-yellow-600 text-yellow-100">
                  TEST MODE: $1 pricing active
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Show Payment Form or Services Selection */}
            {showPaymentForm && paymentData ? (
              <div className="space-y-4">
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm">Additional Payment Required</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>Services added to booking successfully</div>
                      <div>Additional payment of <span className="text-emerald-400 font-bold">${paymentData.amount.toFixed(2)}</span> required</div>
                      <div>Customer payment will be processed immediately</div>
                    </div>
                  </CardContent>
                </Card>

                <InlineStripePaymentForm
                  job={job}
                  amount={paymentData.amount.toFixed(2)}
                  clientSecret={paymentData.clientSecret}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentFailure={handlePaymentFailure}
                />
              </div>
            ) : (
              <>
                {/* Current Job Info */}
                <Card className="bg-slate-700 border-slate-600">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm">Current Job</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>Customer: {job.customer?.name}</div>
                      <div>Date: {job.scheduled_date} at {job.scheduled_start}</div>
                      <div>Original Service: {job.service?.name}</div>
                    </div>
                  </CardContent>
                </Card>

            {/* Services Grid */}
            {loading ? (
              <div className="text-center py-8">
                <p className="text-white">Loading services...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((service) => (
                   <ServiceCard 
                    key={service.id}
                    id={service.id}
                    name={service.name}
                    price={getEffectiveServicePrice(service.base_price, isTestingMode, cart.length)}
                    image={service.image_url || getServiceImage(service.name)}
                    description={service.description || `Professional ${service.name.toLowerCase()} service`}
                    onAddToCart={() => handleServiceClick(service.id, service.name)}
                  />
                ))}
              </div>
            )}

            {/* Cart Section */}
            {cart.length > 0 && (
              <Card className="bg-slate-700 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <ShoppingCart className="h-5 w-5" />
                    <span>Selected Services</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-600 rounded-lg">
                      <div className="flex-1">
                        <span className="text-white font-medium">{item.name}</span>
                        <div className="flex items-center space-x-2 mt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="h-6 w-6 p-0"
                          >
                            -
                          </Button>
                          <span className="text-blue-300 text-sm">Qty: {item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-6 w-6 p-0"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-emerald-400 font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromCart(item.id)}
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t border-slate-500 pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span className="text-white">Total:</span>
                      <span className="text-emerald-400">${getTotalPrice().toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleAddServicesAndCharge}
                    disabled={processing}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    {processing ? 'Processing...' : `Complete Job & Charge Full Amount $${getTotalPrice().toFixed(2)}`}
                  </Button>
                </CardContent>
              </Card>
            )}

                {/* Empty State */}
                {cart.length === 0 && (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700/50 rounded-full mb-4">
                      <Plus className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400 text-lg">Select services to add to this job</p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* TV Mounting Modal */}
      {showTvModal && (
        <TvMountingModal
          open={showTvModal}
          onClose={() => setShowTvModal(false)}
          onAddToCart={handleTvMountingComplete}
          services={services}
        />
      )}

      {/* Reauthorize Payment Dialog */}
      {showReauthorizeDialog && reauthorizeData && (
        <ReauthorizePaymentDialog
          isOpen={showReauthorizeDialog}
          onClose={() => {
            setShowReauthorizeDialog(false);
            setReauthorizeData(null);
          }}
          booking_id={job.id}
          original_amount={reauthorizeData.original_amount}
          new_amount={reauthorizeData.new_amount}
          client_secret={reauthorizeData.client_secret}
          old_payment_intent={reauthorizeData.old_payment_intent}
          new_payment_intent={reauthorizeData.new_payment_intent}
          onSuccess={() => {
            setCart([]);
            onClose();
            onServicesAdded?.();
          }}
        />
      )}
    </>
  );
};