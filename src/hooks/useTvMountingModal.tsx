
import { useState, useMemo } from 'react';
import { PublicService } from '@/hooks/usePublicServicesData';
import { useServicesData } from '@/hooks/useServicesData';
import { useTestingMode, getEffectiveServicePrice } from '@/contexts/TestingModeContext';

interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
  soundbar: boolean;
}

export const useTvMountingModal = (publicServices: PublicService[]) => {
  const { isTestingMode } = useTestingMode();
  // Use full services data (including non-visible add-ons) for finding all services
  const { services: allServices } = useServicesData();
  const [numberOfTvs, setNumberOfTvs] = useState(1);
  const [tvConfigurations, setTvConfigurations] = useState<TvConfiguration[]>([
    { id: '1', over65: false, frameMount: false, wallType: 'standard', soundbar: false }
  ]);

  // Find services from database - use allServices to include non-visible add-ons
  const tvMountingService = allServices.find(s => s.name === 'TV Mounting');
  const over65Service = allServices.find(s => s.name === 'Over 65" TV Add-on');
  const frameMountService = allServices.find(s => s.name === 'Frame Mount Add-on');
  const stoneWallService = allServices.find(s => s.name === 'Stone/Brick/Tile Wall');

  const calculateTvMountingPrice = (numTvs: number) => {
    let totalPrice = 0;
    
    for (let i = 1; i <= numTvs; i++) {
      if (i === 1) {
        totalPrice += 90; // First TV: $90
      } else if (i === 2) {
        totalPrice += 60; // Second TV: $60
      } else {
        totalPrice += 75; // Third TV and beyond: $75 each
      }
    }
    
    return totalPrice;
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
      console.log('TV Mounting - Testing mode active, returning $1 total');
      return 1;
    }

    let price = calculateTvMountingPrice(numberOfTvs);

    tvConfigurations.forEach((config) => {
      if (config.over65) {
        price += (over65Service?.base_price || 25);
      }
      
      if (config.frameMount) {
        price += (frameMountService?.base_price || 25);
      }
      
      if (config.wallType !== 'standard') {
        price += (stoneWallService?.base_price || 50);
      }

      if (config.soundbar) {
        price += 40; // Soundbar mounting: $40
      }
    });

    return price;
  }, [numberOfTvs, tvConfigurations, over65Service?.base_price, frameMountService?.base_price, stoneWallService?.base_price, isTestingMode]);

  const buildServicesList = () => {
    const selectedServices = [];
    
    // Main TV mounting service - ensure we have a valid UUID
    if (!tvMountingService?.id) {
      console.error('❌ TV Mounting service not found in database');
      throw new Error('TV Mounting service is not available. Please contact support.');
    }
    
    const basePrice = isTestingMode ? 1 : calculateTvMountingPrice(numberOfTvs);
    console.log(`TV Mounting buildServicesList - Testing mode: ${isTestingMode}, Base price: $${basePrice}`);
    
    selectedServices.push({
      id: tvMountingService.id,
      name: `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
      price: basePrice,
      quantity: 1
    });

    // Skip add-ons in testing mode since everything is $1 total
    if (isTestingMode) {
      console.log('TV Mounting - Testing mode: Skipping add-on services');
      return selectedServices;
    }

    const over65Count = tvConfigurations.filter(config => config.over65).length;
    if (over65Count > 0) {
      if (!over65Service?.id) {
        console.error('❌ Over 65" TV Add-on service not found in database');
        throw new Error('Over 65" TV Add-on service is not available. Please contact support.');
      }
      selectedServices.push({
        id: over65Service.id,
        name: `Over 65" TV Add-on${over65Count > 1 ? ` (${over65Count} TVs)` : ''}`,
        price: over65Service.base_price * over65Count,
        quantity: 1
      });
    }
    
    const frameMountCount = tvConfigurations.filter(config => config.frameMount).length;
    if (frameMountCount > 0) {
      if (!frameMountService?.id) {
        console.error('❌ Frame Mount Add-on service not found in database');
        throw new Error('Frame Mount Add-on service is not available. Please contact support.');
      }
      selectedServices.push({
        id: frameMountService.id,
        name: `Frame Mount Add-on${frameMountCount > 1 ? ` (${frameMountCount} TVs)` : ''}`,
        price: frameMountService.base_price * frameMountCount,
        quantity: 1
      });
    }
    
    const specialWallCount = tvConfigurations.filter(config => config.wallType !== 'standard').length;
    if (specialWallCount > 0) {
      if (!stoneWallService?.id) {
        console.error('❌ Stone/Brick/Tile Wall service not found in database');
        throw new Error('Special wall service is not available. Please contact support.');
      }
      const wallTypes = [...new Set(tvConfigurations.filter(config => config.wallType !== 'standard').map(config => config.wallType))];
      selectedServices.push({
        id: stoneWallService.id,
        name: `Special Wall Service (${wallTypes.join(', ')})${specialWallCount > 1 ? ` (${specialWallCount} TVs)` : ''}`,
        price: stoneWallService.base_price * specialWallCount,
        quantity: 1
      });
    }

    const soundbarCount = tvConfigurations.filter(config => config.soundbar).length;
    if (soundbarCount > 0) {
      // Find the specific Mount Soundbar service
      const soundbarService = allServices.find(s => s.name === 'Mount Soundbar');
      if (soundbarService?.id) {
        selectedServices.push({
          id: soundbarService.id,
          name: `Soundbar Mount${soundbarCount > 1 ? ` (${soundbarCount} soundbars)` : ''}`,
          price: soundbarService.base_price * soundbarCount,
          quantity: 1
        });
      } else {
        console.warn('⚠️ Mount Soundbar service not found in database, skipping');
      }
    }

    return selectedServices;
  };

  const buildCartItemName = () => {
    let name = `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`;
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
    over65Service,
    frameMountService,
    stoneWallService,
    totalPrice,
    calculateTvMountingPrice,
    buildServicesList,
    buildCartItemName
  };
};
