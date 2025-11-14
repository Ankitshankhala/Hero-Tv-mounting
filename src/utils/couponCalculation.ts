interface Coupon {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount?: number | null;
}

export const calculateCouponDiscount = (
  coupon: Coupon,
  subtotal: number
): number => {
  let discount: number;

  if (coupon.discountType === 'fixed') {
    // Fixed amount discount, but can't exceed subtotal
    discount = Math.min(coupon.discountValue, subtotal);
  } else {
    // Percentage discount
    discount = (subtotal * coupon.discountValue) / 100;
    
    // Apply max cap if exists
    if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
      discount = coupon.maxDiscountAmount;
    }
    
    // Can't exceed subtotal
    discount = Math.min(discount, subtotal);
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimals
};

export const applyCouponToCart = (
  cartTotal: number,
  discount: number
): number => {
  const finalTotal = cartTotal - discount;
  return Math.max(0, finalTotal); // Never go below 0
};