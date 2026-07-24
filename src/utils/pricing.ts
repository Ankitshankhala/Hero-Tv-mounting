import { SERVICE_IDS } from '@/constants/serviceIds';
import { SPECIAL_WALL_TYPES } from '@shared/pricing';

interface BookingService {
  service_name: string;
  service_id?: string;
  base_price: number;
  quantity: number;
  configuration?: any;
}

interface PriceableService {
  id: string;
  name?: string;
  base_price: number | null;
  pricing_config?: {
    add_ons?: Record<string, number>;
  } | null;
}

/**
 * Resolve add-on prices from the live services list (admin-editable).
 * Priority: Mount TV.pricing_config.add_ons > standalone add-on service.base_price.
 * Returns 0 for any add-on that cannot be resolved (so we never invent a number).
 */
export function resolveAddOnPrices(services: PriceableService[] = []) {
  const mountTv = services.find(s => s.id === SERVICE_IDS.mountTv);
  const cfg = mountTv?.pricing_config?.add_ons || {};
  const get = (key: string, fallbackId: string): number => {
    if (typeof cfg[key] === 'number') return Number(cfg[key]);
    const s = services.find(x => x.id === fallbackId);
    return Number(s?.base_price) || 0;
  };
  return {
    over65:      get('over65',      SERVICE_IDS.over65),
    frameMount:  get('frameMount',  SERVICE_IDS.frameMount),
    soundbar:    get('soundbar',    SERVICE_IDS.soundbar),
    specialWall: get('specialWall', SERVICE_IDS.specialWall),
    wireHiding:  get('wireHiding',  SERVICE_IDS.wireHiding),
  };
}

/**
 * Calculate the price for a single service line item, using live admin-editable
 * add-on prices when a services list is provided.
 *
 * IMPORTANT: When `services` is omitted, add-ons resolve to 0 — callers that
 * need accurate Mount TV configuration totals MUST pass the services list.
 */
export function calculateServiceLinePrice(
  service: BookingService,
  services: PriceableService[] = []
): number {
  let price = Number(service.base_price) || 0;
  const config = service.configuration || {};

  if (service.service_name === 'Mount TV' || service.service_id === SERVICE_IDS.mountTv) {
    const addOns = resolveAddOnPrices(services);
    if (config.over65)      price += addOns.over65;
    if (config.frameMount)  price += addOns.frameMount;
    if (config.wallType && (SPECIAL_WALL_TYPES as readonly string[]).includes(config.wallType)) {
      price += addOns.specialWall;
    }
    if (config.soundbar)    price += addOns.soundbar;
    if (config.wireHiding)  price += addOns.wireHiding;
  }

  return price;
}

export function calculateBookingTotal(
  services: BookingService[],
  liveServices: PriceableService[] = []
): number {
  return services.reduce((sum, service) => {
    const servicePrice = calculateServiceLinePrice(service, liveServices);
    const quantity = Number(service.quantity) || 1;
    return sum + (servicePrice * quantity);
  }, 0);
}
