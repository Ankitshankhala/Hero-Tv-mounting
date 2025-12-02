/**
 * Centralized Pricing Engine
 * Single source of truth for all TV mounting pricing calculations
 */

// Flexible service type that works with PublicService, CachedService, and FallbackService
export interface ServiceLike {
  id: string;
  name: string;
  base_price: number | null;
  pricing_config?: {
    pricing_type?: string;
    tiers?: Array<{ quantity: number; price: number; is_default_for_additional?: boolean }>;
    add_ons?: Record<string, number>;
  } | null;
  [key: string]: any;
}

export interface PriceResult {
  price: number;
  source: 'pricing_config' | 'base_price' | 'not_found';
  warning?: string;
}

export interface PriceBreakdown {
  basePrice: number;
  addOns: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  total: number;
}

export interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
  soundbar: boolean;
}

export class PricingEngine {
  /**
   * Get add-on price with validation
   * Priority: pricing_config.add_ons > fallbackService.base_price
   * Logs mismatches for monitoring
   */
  static getAddOnPrice(
    tvMountingService: ServiceLike | undefined,
    addOnKey: string,
    fallbackService?: ServiceLike
  ): PriceResult {
    const configPrice = tvMountingService?.pricing_config?.add_ons?.[addOnKey];
    const basePrice = fallbackService?.base_price;

    // Validate consistency between pricing_config and base_price
    if (configPrice !== undefined && basePrice !== undefined && configPrice !== basePrice) {
      const warning = `PRICING MISMATCH DETECTED: ${addOnKey} - pricing_config=$${configPrice}, base_price=$${basePrice} for service "${fallbackService?.name}"`;
      
      console.error(warning);
      
      // Log to server for admin monitoring
      this.logPricingMismatch(addOnKey, configPrice, basePrice, fallbackService?.name || 'unknown');

      return {
        price: configPrice,
        source: 'pricing_config',
        warning
      };
    }

    // Return the available price
    if (configPrice !== undefined) {
      return {
        price: configPrice,
        source: 'pricing_config'
      };
    }

    if (basePrice !== undefined) {
      return {
        price: basePrice,
        source: 'base_price'
      };
    }

    console.warn(`No price found for add-on: ${addOnKey}`);
    return {
      price: 0,
      source: 'not_found',
      warning: `No price configured for ${addOnKey}`
    };
  }

  /**
   * Get tiered price for TV mounting based on quantity
   */
  static getTierPrice(service: ServiceLike | undefined, quantity: number): number {
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
    return defaultTier?.price || tiers[tiers.length - 1]?.price || service.base_price || 0;
  }

  /**
   * Calculate complete TV mounting configuration price
   */
  static calculateTvMountingTotal(
    numTvs: number,
    tvConfigurations: TvConfiguration[],
    tvMountingService: ServiceLike | undefined,
    addOnServices: {
      over65?: ServiceLike;
      frameMount?: ServiceLike;
      soundbar?: ServiceLike;
      specialWall?: ServiceLike;
    }
  ): PriceBreakdown {
    const addOns: Array<{ name: string; price: number; quantity: number }> = [];
    let basePrice = 0;

    // Calculate base price for all TVs (tiered pricing)
    for (let i = 1; i <= numTvs; i++) {
      basePrice += this.getTierPrice(tvMountingService, i);
    }

    // Calculate add-on prices
    tvConfigurations.forEach((config, index) => {
      const tvNumber = index + 1;

      if (config.over65) {
        const { price } = this.getAddOnPrice(
          tvMountingService,
          'over65',
          addOnServices.over65
        );
        if (price > 0) {
          addOns.push({
            name: `Over 65" TV Add-on (TV ${tvNumber})`,
            price,
            quantity: 1
          });
        }
      }

      if (config.frameMount) {
        const { price } = this.getAddOnPrice(
          tvMountingService,
          'frameMount',
          addOnServices.frameMount
        );
        if (price > 0) {
          addOns.push({
            name: `Frame Mount Add-on (TV ${tvNumber})`,
            price,
            quantity: 1
          });
        }
      }

      if (config.wallType === 'steel' || config.wallType === 'brick' || config.wallType === 'concrete') {
        const { price } = this.getAddOnPrice(
          tvMountingService,
          'specialWall',
          addOnServices.specialWall
        );
        if (price > 0) {
          addOns.push({
            name: `Special Wall Type (TV ${tvNumber})`,
            price,
            quantity: 1
          });
        }
      }

      if (config.soundbar) {
        const { price } = this.getAddOnPrice(
          tvMountingService,
          'soundbar',
          addOnServices.soundbar
        );
        if (price > 0) {
          addOns.push({
            name: `Mount Soundbar (TV ${tvNumber})`,
            price,
            quantity: 1
          });
        }
      }
    });

    const addOnsTotal = addOns.reduce((sum, addOn) => sum + addOn.price * addOn.quantity, 0);
    const subtotal = basePrice + addOnsTotal;

    return {
      basePrice,
      addOns,
      subtotal,
      total: subtotal
    };
  }

  /**
   * Log pricing mismatch to server for admin monitoring
   */
  private static logPricingMismatch(
    addOnKey: string,
    configPrice: number,
    basePrice: number,
    serviceName: string
  ): void {
    // In production, this would send to analytics or logging service
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'pricing_mismatch', {
        add_on_key: addOnKey,
        config_price: configPrice,
        base_price: basePrice,
        service_name: serviceName
      });
    }
  }

  /**
   * Validate pricing consistency across all services
   * Used by admin dashboard
   */
  static async validateAllPricing(services: ServiceLike[]): Promise<{
    isConsistent: boolean;
    mismatches: Array<{
      addOnKey: string;
      configPrice: number;
      basePrice: number;
      serviceName: string;
    }>;
  }> {
    const tvMountingService = services.find(s => s.name === 'Mount TV');
    const mismatches: Array<{
      addOnKey: string;
      configPrice: number;
      basePrice: number;
      serviceName: string;
    }> = [];

    if (!tvMountingService?.pricing_config?.add_ons) {
      return { isConsistent: true, mismatches: [] };
    }

    const addOnsToCheck = [
      { key: 'over65', serviceName: 'Over 65" TV Add-on' },
      { key: 'frameMount', serviceName: 'Frame Mount Add-on' },
      { key: 'soundbar', serviceName: 'Mount Soundbar' },
      { key: 'specialWall', serviceName: 'Brick/Steel/Concrete' }
    ];

    for (const { key, serviceName } of addOnsToCheck) {
      const configPrice = tvMountingService.pricing_config.add_ons[key];
      const service = services.find(s => s.name === serviceName);
      const basePrice = service?.base_price;

      if (configPrice !== undefined && basePrice !== undefined && configPrice !== basePrice) {
        mismatches.push({
          addOnKey: key,
          configPrice,
          basePrice,
          serviceName
        });
      }
    }

    return {
      isConsistent: mismatches.length === 0,
      mismatches
    };
  }
}
