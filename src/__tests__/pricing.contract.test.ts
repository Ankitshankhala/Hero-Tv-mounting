import { describe, it, expect } from 'vitest';
import {
  tierPriceForNth,
  getServiceLineTotal,
  tvAddOnTotal,
  type PricingConfig,
  type ResolvedAddOnPrices,
} from '@shared/pricing';

const mountTv: PricingConfig = {
  tiers: [
    { quantity: 1, price: 90 },
    { quantity: 2, price: 80 },
    { quantity: 3, price: 70, is_default_for_additional: true },
  ],
  base_price: 90,
};

const prices: ResolvedAddOnPrices = { over65: 25, frameMount: 40, soundbar: 40, specialWall: 40 };

describe('pricing contract (frozen)', () => {
  it('tierPriceForNth matches live Mount TV schedule for nth 1..6', () => {
    const got = [1, 2, 3, 4, 5, 6].map(n => tierPriceForNth(mountTv.tiers, mountTv.base_price, n));
    expect(got).toEqual([90, 80, 70, 70, 70, 70]);
  });

  it('getServiceLineTotal(existing=0, add=3) === 240', () => {
    expect(getServiceLineTotal(mountTv, 0, 3)).toBe(240);
  });

  it('getServiceLineTotal(existing=2, add=2) === 140', () => {
    expect(getServiceLineTotal(mountTv, 2, 2)).toBe(140);
  });

  it('tvAddOnTotal — all flags true with special wall types → 145', () => {
    for (const wallType of ['steel', 'brick', 'concrete']) {
      expect(
        tvAddOnTotal({ over65: true, frameMount: true, soundbar: true, wallType }, prices)
      ).toBe(145);
    }
  });

  it('tvAddOnTotal — all flags true, wallType standard → 105', () => {
    expect(
      tvAddOnTotal({ over65: true, frameMount: true, soundbar: true, wallType: 'standard' }, prices)
    ).toBe(105);
  });

  it('tvAddOnTotal — wallType "stone" is NOT special (no +40)', () => {
    expect(
      tvAddOnTotal({ over65: true, frameMount: true, soundbar: true, wallType: 'stone' }, prices)
    ).toBe(105);
  });

  it('non-tiered config falls back to base_price', () => {
    expect(tierPriceForNth(undefined, 75, 1)).toBe(75);
  });

  it('getServiceLineTotal(0, N) matches frozen edge-function contract for N 1..5', () => {
    const expected = [90, 170, 240, 310, 380];
    for (let n = 1; n <= 5; n++) {
      expect(getServiceLineTotal(mountTv, 0, n)).toBe(expected[n - 1]);
    }
  });
});

import { PricingEngine } from '@/utils/pricingEngine';
import { getTierPrice as displayGetTierPrice } from '@/utils/pricingDisplay';

describe('frontend wrappers delegate to canonical (drift lock)', () => {
  const mountTvService = {
    id: 'x',
    name: 'Mount TV',
    base_price: 90,
    pricing_config: {
      tiers: [
        { quantity: 1, price: 90 },
        { quantity: 2, price: 80 },
        { quantity: 3, price: 70, is_default_for_additional: true },
      ],
    },
  } as any;

  it('PricingEngine.getTierPrice matches canonical for n 1..6', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(PricingEngine.getTierPrice(mountTvService, n)).toBe(
        tierPriceForNth(mountTvService.pricing_config.tiers, mountTvService.base_price, n)
      );
    }
  });

  it('pricingDisplay.getTierPrice matches canonical for n 1..6', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(displayGetTierPrice(mountTvService, n)).toBe(
        tierPriceForNth(mountTvService.pricing_config.tiers, mountTvService.base_price, n)
      );
    }
  });
});

