
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Service } from '@/hooks/useServicesData';
import { ImageUpload } from './ImageUpload';
import { PricingConfigEditor, PricingConfig } from './pricing/PricingConfigEditor';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    base_price: number;
    duration_minutes: number;
    image_url?: string | null;
    pricing_config?: PricingConfig | null;
  }) => Promise<void>;
  service?: Service | null;
  title: string;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  service,
  title
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: 0,
    duration_minutes: 60,
    image_url: null as string | null,
    pricing_config: null as PricingConfig | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        description: service.description || '',
        base_price: service.base_price,
        duration_minutes: service.duration_minutes,
        image_url: service.image_url,
        pricing_config: service.pricing_config || null
      });
    } else {
      setFormData({
        name: '',
        description: '',
        base_price: 0,
        duration_minutes: 60,
        image_url: null,
        pricing_config: null
      });
    }
  }, [service, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (url: string | null) => {
    setFormData(prev => ({ ...prev, image_url: url }));
  };

  const handlePricingConfigChange = (config: PricingConfig | null) => {
    setFormData(prev => ({ ...prev, pricing_config: config }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Service Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter service name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter service description"
              rows={3}
            />
          </div>

          <ImageUpload
            currentImageUrl={formData.image_url}
            onImageChange={handleImageChange}
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_price">Price ($) *</Label>
              <Input
                id="base_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => handleChange('base_price', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
              <Input
                id="duration_minutes"
                type="number"
                min="1"
                value={formData.duration_minutes}
                onChange={(e) => handleChange('duration_minutes', parseInt(e.target.value) || 60)}
                placeholder="60"
                required
              />
            </div>
          </div>

          <PricingConfigEditor
            config={formData.pricing_config}
            onChange={handlePricingConfigChange}
            serviceName={formData.name}
          />

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (service ? 'Update' : 'Add')} Service
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
