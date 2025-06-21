
import { useState, useMemo } from 'react';
import { PublicService } from '@/hooks/usePublicServicesData';

interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
  soundbar: boolean;
}

export const useTvMountingModal = (services: PublicService[]) => {
  const [numberOfTvs, setNumberOfTvs] = useState(1);
  const [tvConfigurations, setTvConfigurations] = useState<TvConfiguration[]>([
    { id: '1', over65: false, frameMount: false, wallType: 'standard', soundbar: false }
  ]);

  // Find services from database
  const tvMountingService = services.find(s => s.name === 'TV Mounting');
  const over65Service = services.find(s => s.name === 'Over 65" TV Add-on');
  const frameMountService = services.find(s => s.name === 'Frame Mount Add-on');
  const stoneWallService = services.find(s => s.name === 'Stone/Brick/Tile Wall');

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
  }, [numberOfTvs, tvConfigurations, over65Service?.base_price, frameMountService?.base_price, stoneWallService?.base_price]);

  const buildServicesList = () => {
    const selectedServices = [];
    
    selectedServices.push({
      id: 'tv-mounting-base',
      name: `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
      price: calculateTvMountingPrice(numberOfTvs),
      quantity: 1
    });

    const over65Count = tvConfigurations.filter(config => config.over65).length;
    if (over65Count > 0) {
      selectedServices.push({
        id: over65Service?.id || 'over65-addon',
        name: `Over 65" TV Add-on${over65Count > 1 ? ` (${over65Count} TVs)` : ''}`,
        price: (over65Service?.base_price || 25) * over65Count,
        quantity: 1
      });
    }
    
    const frameMountCount = tvConfigurations.filter(config => config.frameMount).length;
    if (frameMountCount > 0) {
      selectedServices.push({
        id: frameMountService?.id || 'frame-mount-addon',
        name: `Frame Mount Add-on${frameMountCount > 1 ? ` (${frameMountCount} TVs)` : ''}`,
        price: (frameMountService?.base_price || 25) * frameMountCount,
        quantity: 1
      });
    }
    
    const specialWallCount = tvConfigurations.filter(config => config.wallType !== 'standard').length;
    if (specialWallCount > 0) {
      const wallTypes = [...new Set(tvConfigurations.filter(config => config.wallType !== 'standard').map(config => config.wallType))];
      selectedServices.push({
        id: stoneWallService?.id || 'wall-type-addon',
        name: `Special Wall Service (${wallTypes.join(', ')})${specialWallCount > 1 ? ` (${specialWallCount} TVs)` : ''}`,
        price: (stoneWallService?.base_price || 50) * specialWallCount,
        quantity: 1
      });
    }

    const soundbarCount = tvConfigurations.filter(config => config.soundbar).length;
    if (soundbarCount > 0) {
      selectedServices.push({
        id: 'soundbar-mount-addon',
        name: `Soundbar Mount${soundbarCount > 1 ? ` (${soundbarCount} soundbars)` : ''}`,
        price: 40 * soundbarCount,
        quantity: 1
      });
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
