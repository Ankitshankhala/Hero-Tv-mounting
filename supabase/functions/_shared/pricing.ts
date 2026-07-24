// SINGLE SOURCE OF TRUTH for pricing math. Pure, portable TS (no Deno/browser/@ deps).
// Imported by Supabase edge functions (relative) AND the frontend (via @shared alias).
export interface PricingTier { quantity: number; price: number; is_default_for_additional?: boolean }
export interface PricingConfig { tiers?: PricingTier[]; base_price: number; add_ons?: Record<string, number> }

// Canonical tier price for the Nth unit (1-based). Field-match on tier.quantity,
// then is_default_for_additional, then highest defined tier, then base_price.
export function tierPriceForNth(tiers: PricingTier[] | undefined, basePrice: number, nth: number): number {
  if (!tiers || tiers.length === 0) return basePrice;
  const exact = tiers.find(t => t.quantity === nth);
  if (exact) return exact.price;
  const def = tiers.find(t => t.is_default_for_additional);
  if (def) return def.price;
  const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity);
  return sorted[sorted.length - 1]?.price ?? basePrice;
}

// BACK-COMPAT: existing callers pass a 0-based quantity index.
export function getEffectiveServicePrice(config: PricingConfig, quantityIndex: number): number {
  return tierPriceForNth(config.tiers, config.base_price, quantityIndex + 1);
}

export function getServiceLineTotal(config: PricingConfig, existingQty: number, addQty: number): number {
  let total = 0;
  for (let i = 0; i < addQty; i++) total += getEffectiveServicePrice(config, existingQty + i);
  return total;
}

// Canonical special-wall set — matches the customer WallTypeSelector options.
export const SPECIAL_WALL_TYPES = ['steel', 'brick', 'concrete'] as const;

export interface ResolvedAddOnPrices { over65: number; frameMount: number; soundbar: number; specialWall: number; wireHiding: number }
export interface TvConfig { over65?: boolean; frameMount?: boolean; soundbar?: boolean; wallType?: string; wireHiding?: boolean }

// Given already-resolved add-on prices, sum the surcharges for one TV config.
export function tvAddOnTotal(cfg: TvConfig, prices: ResolvedAddOnPrices): number {
  let t = 0;
  if (cfg.over65) t += prices.over65;
  if (cfg.frameMount) t += prices.frameMount;
  if (cfg.soundbar) t += prices.soundbar;
  if (cfg.wallType && (SPECIAL_WALL_TYPES as readonly string[]).includes(cfg.wallType)) t += prices.specialWall;
  if (cfg.wireHiding) t += prices.wireHiding;
  return t;
}
