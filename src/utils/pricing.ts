interface BookingService {
  service_name: string;
  base_price: number;
  quantity: number;
  configuration?: any;
}

export function calculateServiceLinePrice(service: BookingService): number {
  let price = service.base_price;
  const config = service.configuration || {};

  // TV Mounting specific pricing
  if (service.service_name === 'TV Mounting') {
    if (config.over65) price += 50;
    if (config.frameMount) price += 75;
    if (config.wallType === 'stone' || config.wallType === 'brick' || config.wallType === 'tile') {
      price += 100;
    }
    if (config.soundbar) price += 30;
  }

  return price;
}

export function calculateBookingTotal(services: BookingService[]): number {
  return services.reduce((sum, service) => {
    const servicePrice = calculateServiceLinePrice(service);
    return sum + (servicePrice * service.quantity);
  }, 0);
}