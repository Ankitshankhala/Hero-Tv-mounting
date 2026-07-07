interface PricingTier { qty: number; price: number }
interface PricingConfig { tiers?: PricingTier[]; base_price: number }

export function getEffectiveServicePrice(config: PricingConfig, quantityIndex: number): number {
  if (!config.tiers?.length) return config.base_price;
  const tier = config.tiers[Math.min(quantityIndex, config.tiers.length - 1)];
  return tier?.price ?? config.base_price;
}

export function getServiceLineTotal(config: PricingConfig, existingQty: number, addQty: number): number {
  let total = 0;
  for (let i = 0; i < addQty; i++) total += getEffectiveServicePrice(config, existingQty + i);
  return total;
}
