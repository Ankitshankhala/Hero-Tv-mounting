
import { useState, useMemo } from 'react';
import { PublicService } from '@/hooks/usePublicServicesData';

export const useTvMountingModal = (services: PublicService[]) => {
  const [over65, setOver65] = useState(false);
  const [frameMount, setFrameMount] = useState(false);
  const [numberOfTvs, setNumberOfTvs] = useState(1);
  const [wallType, setWallType] = useState('standard');

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

  const totalPrice = useMemo(() => {
    let price = calculateTvMountingPrice(numberOfTvs);

    if (over65) {
      const over65Cost = (over65Service?.base_price || 25) * numberOfTvs;
      price += over65Cost;
    }
    
    if (frameMount) {
      const frameMountCost = (frameMountService?.base_price || 25) * numberOfTvs;
      price += frameMountCost;
    }
    
    if (wallType !== 'standard') {
      const wallCost = (stoneWallService?.base_price || 50) * numberOfTvs;
      price += wallCost;
    }

    return price;
  }, [numberOfTvs, over65, frameMount, wallType, over65Service?.base_price, frameMountService?.base_price, stoneWallService?.base_price]);

  const buildServicesList = () => {
    const selectedServices = [];
    
    selectedServices.push({
      id: 'tv-mounting-base',
      name: `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
      price: calculateTvMountingPrice(numberOfTvs),
      quantity: 1
    });

    if (over65) {
      selectedServices.push({
        id: over65Service?.id || 'over65-addon',
        name: `Over 65" TV Add-on${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
        price: (over65Service?.base_price || 25) * numberOfTvs,
        quantity: 1
      });
    }
    
    if (frameMount) {
      selectedServices.push({
        id: frameMountService?.id || 'frame-mount-addon',
        name: `Frame Mount Add-on${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
        price: (frameMountService?.base_price || 25) * numberOfTvs,
        quantity: 1
      });
    }
    
    if (wallType !== 'standard') {
      selectedServices.push({
        id: stoneWallService?.id || 'wall-type-addon',
        name: `${wallType.charAt(0).toUpperCase() + wallType.slice(1)} Wall Service${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
        price: (stoneWallService?.base_price || 50) * numberOfTvs,
        quantity: 1
      });
    }

    return selectedServices;
  };

  const buildCartItemName = () => {
    let name = `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`;
    const addOns = [];
    
    if (over65) addOns.push('Over 65" TV');
    if (frameMount) addOns.push('Frame Mount');
    if (wallType !== 'standard') addOns.push(`${wallType.charAt(0).toUpperCase() + wallType.slice(1)} Wall`);
    
    if (addOns.length > 0) {
      name += ` + ${addOns.join(' + ')}`;
    }
    
    return name;
  };

  return {
    over65,
    setOver65,
    frameMount,
    setFrameMount,
    numberOfTvs,
    setNumberOfTvs,
    wallType,
    setWallType,
    over65Service,
    frameMountService,
    stoneWallService,
    totalPrice,
    calculateTvMountingPrice,
    buildServicesList,
    buildCartItemName
  };
};
