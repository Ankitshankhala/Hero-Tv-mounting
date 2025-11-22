interface BookingService {
  service_name: string;
  base_price: number;
  quantity: number;
  configuration?: any;
}

/**
 * Calculate the price for a single service line item
 * IMPORTANT: This now uses correct add-on prices from the database
 * - Over 65" TV: $25
 * - Frame Mount: $40
 * - Special Wall: $40
 * - Mount Soundbar: $40
 */
export function calculateServiceLinePrice(service: BookingService): number {
  let price = Number(service.base_price) || 0;
  const config = service.configuration || {};

  // Mount TV specific pricing - using correct prices
  if (service.service_name === 'Mount TV') {
    if (config.over65) price += 25; // Corrected from 50
    if (config.frameMount) price += 40; // Corrected from 75
    if (config.wallType === 'steel' || config.wallType === 'brick' || config.wallType === 'concrete') {
      price += 40;
    }
    if (config.soundbar) price += 40; // Corrected from 30
  }

  return price;
}

export function calculateBookingTotal(services: BookingService[]): number {
  return services.reduce((sum, service) => {
    const servicePrice = calculateServiceLinePrice(service);
    const quantity = Number(service.quantity) || 1;
    return sum + (servicePrice * quantity);
  }, 0);
}