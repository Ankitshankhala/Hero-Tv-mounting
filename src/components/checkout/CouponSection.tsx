import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CouponSectionProps {
  cartTotal: number;
  customerEmail: string;
  userId?: string;
  zipcode: string;
  city: string;
  serviceIds: string[];
  onCouponApplied: (couponCode: string, discountAmount: number, couponId: string) => void;
  onCouponRemoved: () => void;
  appliedCoupon?: {
    code: string;
    discountAmount: number;
  };
}

export const CouponSection = ({
  cartTotal,
  customerEmail,
  userId,
  zipcode,
  city,
  serviceIds,
  onCouponApplied,
  onCouponRemoved,
  appliedCoupon
}: CouponSectionProps) => {
  const [couponCode, setCouponCode] = useState('');
  const [validating, setValidating] = useState(false);
  const { toast } = useToast();

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "Enter a coupon code",
        variant: "destructive"
      });
      return;
    }

    setValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          code: couponCode.toUpperCase(),
          customerEmail,
          userId: userId || null,
          cartTotal,
          zipcode,
          city,
          serviceIds
        }
      });

      if (error) throw error;

      if (data.valid) {
        onCouponApplied(data.couponDetails.code, data.discountAmount, data.couponId);
        toast({
          title: "Coupon Applied!",
          description: `You saved $${data.discountAmount.toFixed(2)}`,
        });
        setCouponCode('');
      } else {
        toast({
          title: "Invalid Coupon",
          description: data.errorMessage,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      toast({
        title: "Error",
        description: "Failed to validate coupon. Please try again.",
        variant: "destructive"
      });
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    onCouponRemoved();
    toast({
      title: "Coupon Removed",
    });
  };

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Tag className="w-4 h-4" />
        <span>Have a coupon code?</span>
      </div>

      {appliedCoupon ? (
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-mono">
                  {appliedCoupon.code}
                </Badge>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  -${appliedCoupon.discountAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Discount applied successfully</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveCoupon}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="flex-1 font-mono uppercase"
            disabled={validating}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyCoupon();
              }
            }}
          />
          <Button
            onClick={handleApplyCoupon}
            disabled={validating || !couponCode.trim()}
            className="whitespace-nowrap"
          >
            {validating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              'Apply'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};