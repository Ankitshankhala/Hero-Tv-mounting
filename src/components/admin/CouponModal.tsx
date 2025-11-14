import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupon?: any;
}

export const CouponModal = ({ isOpen, onClose, coupon }: CouponModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    maxDiscountAmount: '',
    minOrderAmount: '0',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    usageLimitTotal: '',
    usageLimitPerCustomer: '1',
    isActive: true,
    cityRestrictions: [] as string[],
    serviceRestrictions: [] as string[],
  });

  // Load coupon data when editing
  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code || '',
        discountType: coupon.discount_type || 'percentage',
        discountValue: coupon.discount_value?.toString() || '',
        maxDiscountAmount: coupon.max_discount_amount?.toString() || '',
        minOrderAmount: coupon.min_order_amount?.toString() || '0',
        validFrom: coupon.valid_from ? new Date(coupon.valid_from).toISOString().split('T')[0] : '',
        validUntil: coupon.valid_until ? new Date(coupon.valid_until).toISOString().split('T')[0] : '',
        usageLimitTotal: coupon.usage_limit_total?.toString() || '',
        usageLimitPerCustomer: coupon.usage_limit_per_customer?.toString() || '1',
        isActive: coupon.is_active ?? true,
        cityRestrictions: coupon.city_restrictions || [],
        serviceRestrictions: [],
      });
    } else {
      // Reset form for new coupon
      setFormData({
        code: '',
        discountType: 'percentage',
        discountValue: '',
        maxDiscountAmount: '',
        minOrderAmount: '0',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        usageLimitTotal: '',
        usageLimitPerCustomer: '1',
        isActive: true,
        cityRestrictions: [],
        serviceRestrictions: [],
      });
    }
  }, [coupon]);

  // Fetch available cities
  const { data: cities } = useQuery({
    queryKey: ['available-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('us_zip_codes')
        .select('city')
        .order('city');

      if (error) throw error;
      
      // Get unique cities
      const uniqueCities = Array.from(new Set(data.map(item => item.city)));
      return uniqueCities;
    }
  });

  // Fetch available services
  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        code: data.code.toUpperCase(),
        discount_type: data.discountType,
        discount_value: parseFloat(data.discountValue),
        max_discount_amount: data.maxDiscountAmount ? parseFloat(data.maxDiscountAmount) : null,
        min_order_amount: parseFloat(data.minOrderAmount),
        valid_from: new Date(data.validFrom).toISOString(),
        valid_until: new Date(data.validUntil).toISOString(),
        usage_limit_total: data.usageLimitTotal ? parseInt(data.usageLimitTotal) : null,
        usage_limit_per_customer: parseInt(data.usageLimitPerCustomer),
        is_active: data.isActive,
        city_restrictions: data.cityRestrictions.length > 0 ? data.cityRestrictions : null,
      };

      if (coupon) {
        // Update existing
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', coupon.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('coupons')
          .insert(payload);

        if (error) throw error;
      }

      // Handle service restrictions
      if (data.serviceRestrictions.length > 0 && !coupon) {
        const { data: newCoupon } = await supabase
          .from('coupons')
          .select('id')
          .eq('code', data.code.toUpperCase())
          .single();

        if (newCoupon) {
          const serviceLinks = data.serviceRestrictions.map((serviceId: string) => ({
            coupon_id: newCoupon.id,
            service_id: serviceId,
          }));

          await supabase
            .from('coupon_services')
            .insert(serviceLinks);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast({
        title: coupon ? 'Coupon Updated' : 'Coupon Created',
        description: `The coupon has been ${coupon ? 'updated' : 'created'} successfully.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to save coupon: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.code) {
      toast({ title: 'Error', description: 'Coupon code is required', variant: 'destructive' });
      return;
    }

    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      toast({ title: 'Error', description: 'Discount value must be greater than 0', variant: 'destructive' });
      return;
    }

    if (formData.discountType === 'percentage' && !formData.maxDiscountAmount) {
      toast({ title: 'Error', description: 'Max discount amount is required for percentage coupons', variant: 'destructive' });
      return;
    }

    if (!formData.validUntil) {
      toast({ title: 'Error', description: 'Expiration date is required', variant: 'destructive' });
      return;
    }

    if (new Date(formData.validUntil) <= new Date(formData.validFrom)) {
      toast({ title: 'Error', description: 'Expiration date must be after start date', variant: 'destructive' });
      return;
    }

    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? 'Edit Coupon' : 'Create New Coupon'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code */}
          <div>
            <Label htmlFor="code">Coupon Code *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., SUMMER2024"
              className="font-mono uppercase"
              maxLength={50}
            />
          </div>

          {/* Discount Type */}
          <div>
            <Label>Discount Type *</Label>
            <RadioGroup
              value={formData.discountType}
              onValueChange={(value: 'percentage' | 'fixed') => setFormData({ ...formData, discountType: value })}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage" className="cursor-pointer">Percentage</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="fixed" />
                <Label htmlFor="fixed" className="cursor-pointer">Fixed Amount</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Discount Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discountValue">
                {formData.discountType === 'percentage' ? 'Percentage' : 'Amount'} *
              </Label>
              <Input
                id="discountValue"
                type="number"
                step="0.01"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                placeholder={formData.discountType === 'percentage' ? '10' : '20.00'}
              />
            </div>

            {formData.discountType === 'percentage' && (
              <div>
                <Label htmlFor="maxDiscountAmount">Max Discount Amount *</Label>
                <Input
                  id="maxDiscountAmount"
                  type="number"
                  step="0.01"
                  value={formData.maxDiscountAmount}
                  onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                  placeholder="50.00"
                />
              </div>
            )}
          </div>

          {/* Min Order & Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="minOrderAmount">Min Order Amount</Label>
              <Input
                id="minOrderAmount"
                type="number"
                step="0.01"
                value={formData.minOrderAmount}
                onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="validFrom">Valid From *</Label>
              <Input
                id="validFrom"
                type="date"
                value={formData.validFrom}
                onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="validUntil">Valid Until *</Label>
              <Input
                id="validUntil"
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
              />
            </div>
          </div>

          {/* Usage Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="usageLimitTotal">Total Usage Limit</Label>
              <Input
                id="usageLimitTotal"
                type="number"
                value={formData.usageLimitTotal}
                onChange={(e) => setFormData({ ...formData, usageLimitTotal: e.target.value })}
                placeholder="Leave empty for unlimited"
              />
            </div>
            <div>
              <Label htmlFor="usageLimitPerCustomer">Usage Limit Per Customer *</Label>
              <Input
                id="usageLimitPerCustomer"
                type="number"
                value={formData.usageLimitPerCustomer}
                onChange={(e) => setFormData({ ...formData, usageLimitPerCustomer: e.target.value })}
              />
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {coupon ? 'Update' : 'Create'} Coupon
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};