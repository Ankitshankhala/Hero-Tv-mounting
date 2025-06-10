
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Service {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface InvoiceModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onModificationCreated: () => void;
}

const InvoiceModificationModal = ({ 
  isOpen, 
  onClose, 
  job, 
  onModificationCreated 
}: InvoiceModificationModalProps) => {
  const [services, setServices] = useState<Service[]>(
    Array.isArray(job?.services) ? job.services : []
  );
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateServiceQuantity = (serviceId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    
    setServices(services.map(service => 
      service.id === serviceId 
        ? { ...service, quantity: newQuantity }
        : service
    ));
  };

  const removeService = (serviceId: string) => {
    setServices(services.filter(service => service.id !== serviceId));
  };

  const calculateNewTotal = () => {
    return services.reduce((total, service) => total + (service.price * service.quantity), 0);
  };

  const handleSubmitModification = async () => {
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the modification",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const originalTotal = job.total_price;
      const modifiedTotal = calculateNewTotal();

      // Create invoice modification record - cast services to Json
      const { error: modError } = await supabase
        .from('invoice_modifications')
        .insert({
          booking_id: job.id,
          worker_id: job.worker_id,
          original_services: job.services as any,
          modified_services: services as any,
          original_total: originalTotal,
          modified_total: modifiedTotal,
          modification_reason: reason,
          customer_approved: false
        });

      if (modError) throw modError;

      // Update booking with modification flag and pending payment amount
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          has_modifications: true,
          pending_payment_amount: modifiedTotal - originalTotal
        })
        .eq('id', job.id);

      if (bookingError) throw bookingError;

      toast({
        title: "Success",
        description: "Invoice modification created successfully",
      });

      onModificationCreated();
      onClose();
    } catch (error) {
      console.error('Error creating modification:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice modification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const originalTotal = job?.total_price || 0;
  const newTotal = calculateNewTotal();
  const difference = newTotal - originalTotal;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Modify Invoice - Job #{job?.id?.slice(0, 8)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label className="text-white">Services</Label>
            <div className="space-y-3 mt-2">
              {services.map((service) => (
                <Card key={service.id} className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{service.name}</h4>
                        <p className="text-slate-400">${service.price} each</p>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateServiceQuantity(service.id, service.quantity - 1)}
                            disabled={service.quantity <= 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={service.quantity}
                            onChange={(e) => updateServiceQuantity(service.id, parseInt(e.target.value) || 0)}
                            className="w-16 text-center bg-slate-600 border-slate-500"
                            min="0"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateServiceQuantity(service.id, service.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeService(service.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-right">
                      <span className="text-white font-semibold">
                        Subtotal: ${(service.price * service.quantity).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-slate-400">Original Total</p>
              <p className="text-white font-bold text-xl">${originalTotal.toFixed(2)}</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-slate-400">New Total</p>
              <p className="text-white font-bold text-xl">${newTotal.toFixed(2)}</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-slate-400">Difference</p>
              <p className={`font-bold text-xl ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {difference >= 0 ? '+' : ''}${difference.toFixed(2)}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="reason" className="text-white">Reason for Modification</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the invoice is being modified (e.g., customer changed mind about quantity)"
              className="mt-2 bg-slate-700 border-slate-600 text-white"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitModification}
              disabled={loading || services.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creating...' : 'Create Modification'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceModificationModal;
