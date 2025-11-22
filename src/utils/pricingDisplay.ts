import { PublicService } from '@/hooks/usePublicServicesData';
import { PricingEngine } from './pricingEngine';

/**
 * Formats tiered pricing display for TV mounting service
 * e.g., "1st TV: $90, 2nd TV: $80, Additional TVs: $70 each"
 */
export const formatTieredPricing = (service: PublicService | undefined): string => {
  if (!service?.pricing_config?.tiers) {
    return '';
  }

  const tiers = service.pricing_config.tiers;
  const parts: string[] = [];

  tiers.forEach((tier, index) => {
    if (tier.quantity === 1) {
      parts.push(`1st TV: $${tier.price}`);
    } else if (tier.quantity === 2) {
      parts.push(`2nd TV: $${tier.price}`);
    } else if (tier.is_default_for_additional) {
      parts.push(`Additional TVs: $${tier.price} each`);
    }
  });

  return parts.join(', ');
};

/**
 * Gets the price for a specific add-on using centralized PricingEngine
 * @deprecated Use PricingEngine.getAddOnPrice() directly for full validation
 */
export const getAddOnPrice = (
  tvMountingService: PublicService | undefined,
  addOnKey: string,
  fallbackService?: PublicService,
  defaultPrice: number = 0
): number => {
  const result = PricingEngine.getAddOnPrice(tvMountingService, addOnKey, fallbackService);
  return result.price || defaultPrice;
};

/**
 * Gets the price for a specific quantity from tiered pricing
 */
export const getTierPrice = (
  service: PublicService | undefined,
  quantity: number
): number => {
  if (!service?.pricing_config?.tiers) {
    return service?.base_price || 0;
  }

  const tiers = service.pricing_config.tiers;
  const tier = tiers.find(t => t.quantity === quantity);
  
  if (tier) {
    return tier.price;
  }

  // Use default additional TV price for quantities beyond defined tiers
  const defaultTier = tiers.find(t => t.is_default_for_additional);
  return defaultTier?.price || tiers[tiers.length - 1].price;
};
