import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCoupons, type Coupon } from '@/hooks/useCoupons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface EditCouponModalProps {
  open: boolean;
  onClose: () => void;
  coupon: Coupon;
  onSuccess: () => void;
}

export const EditCouponModal = ({ open, onClose, coupon, onSuccess }: EditCouponModalProps) => {
  const { updateCoupon } = useCoupons();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    max_discount_amount: coupon.max_discount_amount,
    min_order_amount: coupon.min_order_amount || 0,
    is_active: coupon.is_active,
    valid_from: new Date(coupon.valid_from).toISOString().split('T')[0],
    valid_until: new Date(coupon.valid_until).toISOString().split('T')[0],
    usage_limit_total: coupon.usage_limit_total,
    usage_limit_per_customer: coupon.usage_limit_per_customer,
  });

  useEffect(() => {
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      max_discount_amount: coupon.max_discount_amount,
      min_order_amount: coupon.min_order_amount || 0,
      is_active: coupon.is_active,
      valid_from: new Date(coupon.valid_from).toISOString().split('T')[0],
      valid_until: new Date(coupon.valid_until).toISOString().split('T')[0],
      usage_limit_total: coupon.usage_limit_total,
      usage_limit_per_customer: coupon.usage_limit_per_customer,
    });
  }, [coupon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateCoupon(coupon.id, {
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        max_discount_amount: formData.max_discount_amount,
        min_order_amount: formData.min_order_amount,
        is_active: formData.is_active,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString(),
        usage_limit_total: formData.usage_limit_total,
        usage_limit_per_customer: formData.usage_limit_per_customer,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating coupon:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Coupon: {coupon.code}</DialogTitle>
        </DialogHeader>

        {coupon.usage_count > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This coupon has been used {coupon.usage_count} time(s). Changes may affect active bookings.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Coupon Code */}
            <div className="col-span-2">
              <Label htmlFor="code">Coupon Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                className="font-mono"
              />
            </div>

            {/* Discount Type */}
            <div>
              <Label htmlFor="discount_type">Discount Type *</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value: 'percentage' | 'fixed') =>
                  setFormData({ ...formData, discount_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discount Value */}
            <div>
              <Label htmlFor="discount_value">
                Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
              </Label>
              <Input
                id="discount_value"
                type="number"
                step="0.01"
                min="0"
                max={formData.discount_type === 'percentage' ? 100 : undefined}
                value={formData.discount_value}
                onChange={(e) =>
                  setFormData({ ...formData, discount_value: parseFloat(e.target.value) })
                }
                required
              />
            </div>

            {/* Max Discount (for percentage) */}
            {formData.discount_type === 'percentage' && (
              <div>
                <Label htmlFor="max_discount_amount">Max Discount Amount ($)</Label>
                <Input
                  id="max_discount_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.max_discount_amount || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_discount_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="Optional"
                />
              </div>
            )}

            {/* Min Order Amount */}
            <div>
              <Label htmlFor="min_order_amount">Minimum Order Amount ($)</Label>
              <Input
                id="min_order_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.min_order_amount}
                onChange={(e) =>
                  setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) })
                }
              />
            </div>

            {/* Valid From */}
            <div>
              <Label htmlFor="valid_from">Valid From *</Label>
              <Input
                id="valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                required
              />
            </div>

            {/* Valid Until */}
            <div>
              <Label htmlFor="valid_until">Valid Until *</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                required
              />
            </div>

            {/* Usage Limit Total */}
            <div>
              <Label htmlFor="usage_limit_total">Total Usage Limit</Label>
              <Input
                id="usage_limit_total"
                type="number"
                min="1"
                value={formData.usage_limit_total || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    usage_limit_total: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="Unlimited"
              />
            </div>

            {/* Usage Limit Per Customer */}
            <div>
              <Label htmlFor="usage_limit_per_customer">Usage Limit Per Customer *</Label>
              <Input
                id="usage_limit_per_customer"
                type="number"
                min="1"
                value={formData.usage_limit_per_customer}
                onChange={(e) =>
                  setFormData({ ...formData, usage_limit_per_customer: parseInt(e.target.value) })
                }
                required
              />
            </div>

            {/* Active Status */}
            <div className="col-span-2 flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Coupon'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
