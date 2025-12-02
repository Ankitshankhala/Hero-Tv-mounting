// Hardcoded fallback services for instant modal interaction
// These IDs and prices are from the production database and rarely change
// Used as immediate fallback before network fetch completes

// Flexible service type that works with both PublicService and CachedService
export interface FallbackService {
  id: string;
  name: string;
  base_price: number;
  description: string | null;
  duration_minutes: number | null;
  is_active: boolean;
  is_visible: boolean;
  pricing_config?: {
    pricing_type?: string;
    tiers?: Array<{ quantity: number; price: number; is_default_for_additional?: boolean }>;
    add_ons?: Record<string, number>;
  } | null;
  sort_order: number;
  image_url: string | null;
  created_at: string | null;
}

export const TV_MOUNTING_FALLBACK_SERVICES: Record<string, FallbackService> = {
  mountTv: {
    id: 'a50013bc-ee03-4452-b3ec-1683094d787a',
    name: 'Mount TV',
    base_price: 90,
    description: null,
    duration_minutes: null,
    is_active: true,
    is_visible: true,
    pricing_config: {
      pricing_type: 'tiered',
      tiers: [
        { quantity: 1, price: 90 },
        { quantity: 2, price: 80 },
        { quantity: 3, price: 70, is_default_for_additional: true }
      ],
      add_ons: {
        over65: 25,
        frameMount: 40,
        soundbar: 40,
        specialWall: 40
      }
    },
    sort_order: 0,
    image_url: null,
    created_at: null
  },
  over65: {
    id: '81194c48-77a8-496e-9d87-f048fe501df0',
    name: 'Over 65" TV Add-on',
    base_price: 25,
    description: null,
    duration_minutes: null,
    is_active: true,
    is_visible: false,
    pricing_config: null,
    sort_order: 0,
    image_url: null,
    created_at: null
  },
  frameMount: {
    id: '1b47852d-4cbf-439a-89dc-41bac8bcc20e',
    name: 'Frame Mount Add-on',
    base_price: 40,
    description: null,
    duration_minutes: null,
    is_active: true,
    is_visible: false,
    pricing_config: null,
    sort_order: 0,
    image_url: null,
    created_at: null
  },
  soundbar: {
    id: '41ec18d4-516b-4af6-9b05-e38b534923dd',
    name: 'Mount Soundbar',
    base_price: 40,
    description: null,
    duration_minutes: null,
    is_active: true,
    is_visible: true,
    pricing_config: null,
    sort_order: 0,
    image_url: null,
    created_at: null
  },
  specialWall: {
    id: 'b86fda8c-a667-4dee-b180-3c83d6329c3f',
    name: 'Brick/Steel/Concrete',
    base_price: 40,
    description: null,
    duration_minutes: null,
    is_active: true,
    is_visible: false,
    pricing_config: null,
    sort_order: 0,
    image_url: null,
    created_at: null
  }
};

// Convert fallback services to array format for compatibility
export const getFallbackServicesArray = () => {
  return Object.values(TV_MOUNTING_FALLBACK_SERVICES).map(service => ({
    ...service,
    description: null,
    duration_minutes: null,
    image_url: null,
    sort_order: 0,
    created_at: null
  }));
};
