import { describe, it, expect } from 'vitest';
import { calculateCouponDiscount, applyCouponToCart } from '@/utils/couponCalculation';

describe('coupon discount math (frozen)', () => {
  it('fixed discount applies as-is', () => {
    expect(calculateCouponDiscount({ discountType: 'fixed', discountValue: 20 }, 100)).toBe(20);
  });
  it('fixed discount cannot exceed subtotal', () => {
    expect(calculateCouponDiscount({ discountType: 'fixed', discountValue: 150 }, 100)).toBe(100);
  });
  it('percentage discount', () => {
    expect(calculateCouponDiscount({ discountType: 'percentage', discountValue: 10 }, 100)).toBe(10);
  });
  it('percentage discount respects max cap', () => {
    expect(calculateCouponDiscount({ discountType: 'percentage', discountValue: 50, maxDiscountAmount: 30 }, 100)).toBe(30);
  });
  it('percentage discount cannot exceed subtotal', () => {
    expect(calculateCouponDiscount({ discountType: 'percentage', discountValue: 200 }, 40)).toBe(40);
  });
  it('rounds to 2 decimals', () => {
    expect(calculateCouponDiscount({ discountType: 'percentage', discountValue: 10 }, 99.99)).toBe(10);
  });
  it('applyCouponToCart subtracts discount', () => {
    expect(applyCouponToCart(100, 30)).toBe(70);
  });
  it('applyCouponToCart never goes below zero', () => {
    expect(applyCouponToCart(20, 50)).toBe(0);
  });
});
