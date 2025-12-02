
import { useState, useMemo } from 'react';
import { PublicService } from '@/hooks/usePublicServicesData';
import { useTestingMode } from '@/contexts/TestingModeContext';
import { PricingEngine } from '@/utils/pricingEngine';
import { useServicesCache } from '@/contexts/ServicesCacheContext';
import { TV_MOUNTING_FALLBACK_SERVICES, FallbackService } from '@/constants/fallbackServices';

interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
  soundbar: boolean;
}

// Union type that works with all service sources
type ServiceType = FallbackService | PublicService | { id: string; name: string; base_price: number | null; pricing_config?: any; [key: string]: any };

export const useTvMountingModal = (publicServices: PublicService[]) => {
  const { isTestingMode } = useTestingMode();
  // Use cached services with instant fallback - no blocking network fetch
  const { allServices: cachedServices, isLoading: servicesLoading } = useServicesCache();
  
  const [numberOfTvs, setNumberOfTvs] = useState(1);
  const [tvConfigurations, setTvConfigurations] = useState<TvConfiguration[]>([
    { id: '1', over65: false, frameMount: false, wallType: 'standard', soundbar: false }
  ]);

  // Merge services: cached > passed props > fallback (priority order)
  const effectiveServices = useMemo((): ServiceType[] => {
    if (cachedServices.length > 0) return cachedServices;
    if (publicServices.length > 0) return publicServices;
    return Object.values(TV_MOUNTING_FALLBACK_SERVICES);
  }, [cachedServices, publicServices]);

  // Find services - always available immediately via fallback
  const tvMountingService: ServiceType = effectiveServices.find(s => s.name === 'Mount TV') || TV_MOUNTING_FALLBACK_SERVICES.mountTv;
  const over65Service: ServiceType = effectiveServices.find(s => s.name === 'Over 65" TV Add-on') || TV_MOUNTING_FALLBACK_SERVICES.over65;
  const frameMountService: ServiceType = effectiveServices.find(s => s.name === 'Frame Mount Add-on') || TV_MOUNTING_FALLBACK_SERVICES.frameMount;
  const stoneWallService: ServiceType = effectiveServices.find(s => s.name === 'Brick/Steel/Concrete') || TV_MOUNTING_FALLBACK_SERVICES.specialWall;
  
  // Always ready immediately with fallback data
  const isReady = Boolean(tvMountingService?.id);

  const calculateTvMountingPrice = (numTvs: number) => {
    // Use dynamic pricing from pricing_config if available
    const pricingConfig = (tvMountingService as any)?.pricing_config;
    if (pricingConfig?.tiers) {
      const tiers = pricingConfig.tiers;
      let totalPrice = 0;
      
      for (let i = 1; i <= numTvs; i++) {
        const tier = tiers.find(t => t.quantity === i);
        if (tier) {
          totalPrice += tier.price;
        } else {
          // Use default additional TV price for TVs beyond defined tiers
          const defaultTier = tiers.find(t => t.is_default_for_additional);
          totalPrice += defaultTier?.price || tiers[tiers.length - 1].price;
        }
      }
      
      return totalPrice;
    }
    
    // Fallback to base_price * quantity if no pricing_config
    return numTvs * (tvMountingService?.base_price || 90);
  };

  // Update TV configurations when number of TVs changes
  const updateNumberOfTvs = (newNumber: number) => {
    setNumberOfTvs(newNumber);
    
    const newConfigurations = [...tvConfigurations];
    
    // Add new configurations if increasing
    while (newConfigurations.length < newNumber) {
      newConfigurations.push({
        id: (newConfigurations.length + 1).toString(),
        over65: false,
        frameMount: false,
        wallType: 'standard',
        soundbar: false
      });
    }
    
    // Remove configurations if decreasing
    while (newConfigurations.length > newNumber) {
      newConfigurations.pop();
    }
    
    setTvConfigurations(newConfigurations);
  };

  const updateTvConfiguration = (tvId: string, updates: Partial<Omit<TvConfiguration, 'id'>>) => {
    setTvConfigurations(prev => 
      prev.map(config => 
        config.id === tvId ? { ...config, ...updates } : config
      )
    );
  };

  const totalPrice = useMemo(() => {
    if (isTestingMode) {
      // In test mode, calculate total based on number of selected configurations
      const selectedConfigs = tvConfigurations.filter(config => 
        config.over65 || config.frameMount || config.wallType !== 'standard' || config.soundbar
      );
      const totalItems = 1 + selectedConfigs.length; // Base service + addons
      console.log(`TV Mounting - Testing mode active, ${totalItems} items, returning $${totalItems} total`);
      return totalItems;
    }

    // Use centralized PricingEngine for accurate calculations
    const soundbarService = effectiveServices.find(s => s.name === 'Mount Soundbar') || TV_MOUNTING_FALLBACK_SERVICES.soundbar;
    const breakdown = PricingEngine.calculateTvMountingTotal(
      numberOfTvs,
      tvConfigurations,
      tvMountingService,
      {
        over65: over65Service,
        frameMount: frameMountService,
        soundbar: soundbarService,
        specialWall: stoneWallService
      }
    );

    return breakdown.total;
  }, [numberOfTvs, tvConfigurations, tvMountingService, over65Service, frameMountService, stoneWallService, effectiveServices, isTestingMode]);

  const buildServicesList = () => {
    const selectedServices = [];
    
    // Main TV mounting service - ensure we have a valid UUID
    if (!tvMountingService?.id) {
      console.warn('TV Mounting service not ready; returning empty list');
      return selectedServices;
    }
    
    let serviceIndex = 0;
    const basePrice = isTestingMode ? (serviceIndex + 1) : calculateTvMountingPrice(numberOfTvs);
    console.log(`TV Mounting buildServicesList - Testing mode: ${isTestingMode}, Base price: $${basePrice}`);
    
    selectedServices.push({
      id: tvMountingService.id,
      name: `Mount TV${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
      price: basePrice,
      quantity: 1
    });
    serviceIndex++;

    // In testing mode, include add-ons with incremental pricing
    if (isTestingMode) {
      console.log('TV Mounting - Testing mode: Including add-ons with incremental pricing');
    }

    const over65Count = tvConfigurations.filter(config => config.over65).length;
    if (over65Count > 0) {
      if (over65Service?.id) {
        const price = isTestingMode ? (serviceIndex + 1) : (over65Service.base_price * over65Count);
        selectedServices.push({
          id: over65Service.id,
          name: `Over 65" TV Add-on${over65Count > 1 ? ` (${over65Count} TVs)` : ''}`,
          price: price,
          quantity: 1
        });
        serviceIndex++;
      } else {
        console.warn('Over 65" TV Add-on service not found in database, skipping');
      }
    }
    
    const frameMountCount = tvConfigurations.filter(config => config.frameMount).length;
    if (frameMountCount > 0) {
      if (frameMountService?.id) {
        const price = isTestingMode ? (serviceIndex + 1) : (frameMountService.base_price * frameMountCount);
        selectedServices.push({
          id: frameMountService.id,
          name: `Frame Mount Add-on${frameMountCount > 1 ? ` (${frameMountCount} TVs)` : ''}`,
          price: price,
          quantity: 1
        });
        serviceIndex++;
      } else {
        console.warn('Frame Mount Add-on service not found in database, skipping');
      }
    }
    
    const specialWallCount = tvConfigurations.filter(config => config.wallType !== 'standard').length;
    if (specialWallCount > 0) {
      if (stoneWallService?.id) {
        const wallTypes = [...new Set(tvConfigurations.filter(config => config.wallType !== 'standard').map(config => config.wallType))];
        const price = isTestingMode ? (serviceIndex + 1) : (stoneWallService.base_price * specialWallCount);
        selectedServices.push({
          id: stoneWallService.id,
          name: `Special Wall Service (${wallTypes.join(', ')})${specialWallCount > 1 ? ` (${specialWallCount} TVs)` : ''}`,
          price: price,
          quantity: 1
        });
        serviceIndex++;
      } else {
        console.warn('Steel/Brick/Concrete Wall service not found in database, skipping');
      }
    }

    const soundbarCount = tvConfigurations.filter(config => config.soundbar).length;
    if (soundbarCount > 0) {
      // Find the specific Mount Soundbar service - use fallback if not found
      const soundbarService = effectiveServices.find(s => s.name === 'Mount Soundbar') || TV_MOUNTING_FALLBACK_SERVICES.soundbar;
      if (soundbarService?.id) {
        const price = isTestingMode ? (serviceIndex + 1) : ((soundbarService.base_price || 40) * soundbarCount);
        selectedServices.push({
          id: soundbarService.id,
          name: `Soundbar Mount${soundbarCount > 1 ? ` (${soundbarCount} soundbars)` : ''}`,
          price: price,
          quantity: 1
        });
        serviceIndex++;
      }
    }

    return selectedServices;
  };

  const buildCartItemName = () => {
    let name = `Mount TV${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`;
    const addOns = [];
    
    const over65Count = tvConfigurations.filter(config => config.over65).length;
    const frameMountCount = tvConfigurations.filter(config => config.frameMount).length;
    const specialWallCount = tvConfigurations.filter(config => config.wallType !== 'standard').length;
    const soundbarCount = tvConfigurations.filter(config => config.soundbar).length;
    
    if (over65Count > 0) addOns.push(`Over 65" TV (${over65Count})`);
    if (frameMountCount > 0) addOns.push(`Frame Mount (${frameMountCount})`);
    if (specialWallCount > 0) addOns.push(`Special Wall (${specialWallCount})`);
    if (soundbarCount > 0) addOns.push(`Soundbar Mount (${soundbarCount})`);
    
    if (addOns.length > 0) {
      name += ` + ${addOns.join(' + ')}`;
    }
    
    return name;
  };

  return {
    numberOfTvs,
    setNumberOfTvs: updateNumberOfTvs,
    tvConfigurations,
    updateTvConfiguration,
    tvMountingService,
    over65Service,
    frameMountService,
    stoneWallService,
    totalPrice,
    calculateTvMountingPrice,
    buildServicesList,
    buildCartItemName,
    isReady,
    servicesLoading
  };
};
