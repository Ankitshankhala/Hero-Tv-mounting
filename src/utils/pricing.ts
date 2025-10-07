interface BookingService {
  service_name: string;
  base_price: number;
  quantity: number;
  configuration?: any;
}

export function calculateServiceLinePrice(service: BookingService): number {
  let price = Number(service.base_price) || 0;
  const config = service.configuration || {};

  // Mount TV specific pricing
  if (service.service_name === 'Mount TV') {
    if (config.over65) price += 50;
    if (config.frameMount) price += 75;
    if (config.wallType === 'steel' || config.wallType === 'brick' || config.wallType === 'concrete') {
      price += 40;
    }
    if (config.soundbar) price += 30;
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