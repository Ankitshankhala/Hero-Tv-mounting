import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceCard } from '@/components/ServiceCard';
import { TvMountingModal } from '@/components/TvMountingModal';
import { ReauthorizePaymentDialog } from './payment/ReauthorizePaymentDialog';
import { CartItem } from '@/types';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTestingMode, getEffectiveServicePrice } from '@/contexts/TestingModeContext';
import { ShoppingCart, Plus, X } from 'lucide-react';

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
  const [showReauthorizeDialog, setShowReauthorizeDialog] = useState(false);
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
    // Only block if payment has actually been captured — completed-but-authorized bookings must remain accessible
    if (job.payment_status === 'captured') {
      toast({
        title: "Cannot Add Services",
        description: "This booking's payment has already been captured. Please create a new booking for additional services.",
        variant: "destructive",
      });
      return;
    }

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

      // C1 fix: forward Bearer token — payment-engine.recalculate runs validateAuth().
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('add-booking-services', {
        body: {
          booking_id: job.id,
          testing_mode: isTestingMode,
          services: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            configuration: item.options || {}
          }))
        },
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });

      if (error) {
        console.error('Error adding services:', error);
        toast({
          title: "Failed to Add Services",
          description: error.message || 'An unexpected error occurred while adding services. Please try again.',
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      if (!data?.success) {
        const errorMessage = data?.error || 'Failed to add services and update payment authorization';
        const errorCode = data?.error_code || 'UNKNOWN';
        
        toast({
          title: "Service Addition Failed",
          description: `${errorMessage} (Code: ${errorCode})`,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // No saved payment method on file — cannot trigger Stripe UI; surface clear guidance.
      if (data.action === 'requires_manual_payment') {
        toast({
          title: "Manual Payment Required",
          description: "No saved card on file for this booking. Send the customer a payment link from the booking details to authorize the new amount.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      // Card requires 3DS / fresh confirmation — engine returned a new PI awaiting customer action.
      if (
        (data.action === 'requires_customer_action' || data.requires_new_payment) &&
        data.client_secret
      ) {
        toast({
          title: "Payment Re-authorization Required",
          description: "Your card doesn't support authorization updates. Please re-enter card details.",
        });

        setReauthorizeData({
          original_amount: currentAmount,
          new_amount: data.new_amount,
          client_secret: data.client_secret,
          old_payment_intent: data.old_payment_intent_id,
          new_payment_intent: data.new_payment_intent_id,
        });
        setShowReauthorizeDialog(true);
        setProcessing(false);
        return;
      }

      // Authorization-only flow: NEVER capture, complete, or archive from this modal.
      // Capture happens exclusively via worker-complete-and-capture when the worker
      // clicks "Complete Job & Accept Payment".
      const newAuthorized = typeof data.new_amount === 'number' ? data.new_amount : null;
      toast({
        title: "✓ Services Added",
        description: newAuthorized != null
          ? `Authorization updated to $${newAuthorized.toFixed(2)}. Complete the job to capture payment.`
          : `Services added. Complete the job to capture payment.`,
      });

      setCart([]);
      setProcessing(false);
      onClose();
      onServicesAdded?.();
      return;

    } catch (error: any) {
      console.error('Error adding services and charging:', error);
      
      let errorTitle = "Service Addition Failed";
      let errorDescription = "An unexpected error occurred while adding services. Please try again.";
      
      if (error.error_code) {
        errorTitle = `Error: ${error.error_code}`;
        errorDescription = error.error || error.details || errorDescription;
      } else if (error instanceof Error) {
        errorDescription = error.message;
      }
      
      if (error.message?.includes('payment')) {
        errorDescription += " Please verify the payment method is valid.";
      } else if (error.message?.includes('booking')) {
        errorDescription += " Please refresh the page and try again.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:text-slate-300 [&>button]:hover:opacity-80">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center space-x-2">
              <span>{`Add Services to Job #${job.id.slice(0, 8)}`}</span>
              {isTestingMode && (
                <Badge variant="secondary" className="bg-yellow-600 text-yellow-100">
                  TEST MODE: $1 pricing active
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
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
                    <Plus className="h-5 w-5 mr-2" />
                    {processing ? 'Processing...' : `Add Services to Job (+$${getTotalPrice().toFixed(2)})`}
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