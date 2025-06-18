
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OnSiteChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onChargeSuccess: () => void;
}

const OnSiteChargeModal = ({ isOpen, onClose, job, onChargeSuccess }: OnSiteChargeModalProps) => {
  const [formData, setFormData] = useState({
    serviceName: '',
    amount: '',
    description: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.serviceName || !formData.amount) {
      toast({
        title: "Error",
        description: "Please fill in service name and amount",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Since the on_site_charges table doesn't exist, we'll simulate the functionality
      toast({
        title: "Success",
        description: `Charged $${formData.amount} for ${formData.serviceName} (simulated)`,
      });

      onChargeSuccess();
      onClose();
      setFormData({ serviceName: '', amount: '', description: '' });
    } catch (error) {
      console.error('Error processing charge:', error);
      toast({
        title: "Error",
        description: "Failed to process charge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
      setFormData({ serviceName: '', amount: '', description: '' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-green-400" />
            <span>Charge for Additional Service</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <h4 className="font-semibold text-white mb-2">Job Details</h4>
            <div className="text-slate-300 text-sm space-y-1">
              <p><strong>Customer:</strong> {job?.customer?.name || 'N/A'}</p>
              <p><strong>Address:</strong> {job?.location_notes || 'N/A'}</p>
              <p><strong>Service:</strong> {job?.service_id || 'N/A'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceName" className="text-white">Service Name *</Label>
            <Input
              id="serviceName"
              value={formData.serviceName}
              onChange={(e) => setFormData({...formData, serviceName: e.target.value})}
              placeholder="e.g., Additional TV Mount, Cable Extension..."
              className="bg-slate-700 border-slate-600 text-white"
              disabled={isProcessing}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-white">Amount ($) *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
                className="bg-slate-700 border-slate-600 text-white pl-10"
                disabled={isProcessing}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Additional details about the service..."
              className="bg-slate-700 border-slate-600 text-white"
              disabled={isProcessing}
            />
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
            <p className="text-yellow-200 text-sm">
              <strong>Note:</strong> This charge would be processed using the customer's payment method on file.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button"
              variant="outline" 
              onClick={handleClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isProcessing || !formData.serviceName || !formData.amount}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? 'Processing...' : `Charge $${formData.amount || '0.00'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OnSiteChargeModal;
