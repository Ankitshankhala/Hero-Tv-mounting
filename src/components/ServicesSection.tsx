import React, { useMemo, useState } from 'react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { CartItem } from '@/types';
import { useServicesCache } from '@/contexts/ServicesCacheContext';
import { SERVICE_IDS } from '@/constants/serviceIds';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

const getServiceImage = (serviceName: string): string => {
  const imageMap: { [key: string]: string } = {
    'Mount TV': '/lovable-uploads/9b4cf239-a12b-4275-9ca2-a4abafb59c40.png',
    'Full Motion Mount': '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
    'Flat Mount': '/lovable-uploads/4a49b814-b16a-4daf-aa91-3a52fcbb5fae.png',
    'Cover Cables': '/lovable-uploads/6889f051-f5b1-4f2a-a093-a09693378bd4.png',
    'Simple Cable Concealment': '/lovable-uploads/cf56b4f9-cc16-4662-ba09-6186268ae1a0.png',
    'Fire Safe Cable Concealment': '/lovable-uploads/ebfd43c9-5c9d-4d15-b395-a22f44063cb6.png',
    'General Mounting': '/lovable-uploads/a5b8dff7-04c1-4590-a491-0d8a7f9d004c.png',
    'Furniture Assembly': '/lovable-uploads/fe916134-126d-4cff-aefa-608f842b536a.png',
    'Hire Second Technician': '/lovable-uploads/f430204b-2ef5-4727-b3ee-7f4d9d26ded4.png',
  };
  return imageMap[serviceName] || '/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png';
};

const CATEGORY_ORDER = ['TV Mounting', 'Cable Concealment', 'Furniture', 'Add-ons', 'Premium', 'Other'] as const;
type Category = typeof CATEGORY_ORDER[number];

const categorize = (name: string): Category => {
  const n = name.toLowerCase();
  if (/cable|conceal|wire/.test(n)) return 'Cable Concealment';
  if (/furniture|assembly|desk|shelf|shelv|cabinet|drawer/.test(n)) return 'Furniture';
  if (/mount|tv|bracket/.test(n)) return 'TV Mounting';
  if (/premium|frame|full motion|steel|brick|concrete/.test(n)) return 'Premium';
  if (/technician|second|extra|haul|remove|dismount|soundbar|over 65/.test(n)) return 'Add-ons';
  return 'Other';
};

export const ServicesSection = ({ onAddToCart }: ServicesSectionProps) => {
  const [showTvModal, setShowTvModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const { publicServices, isLoading } = useServicesCache();

  // Exclude worker-only / internal items
  const storefrontServices = useMemo(
    () => publicServices.filter((s) => s.is_visible && !/worker only/i.test(s.name)),
    [publicServices]
  );

  const grouped = useMemo(() => {
    const map = new Map<Category, typeof storefrontServices>();
    for (const s of storefrontServices) {
      const c = categorize(s.name);
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(s);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [storefrontServices]);

  const availableCategories: (Category | 'All')[] = ['All', ...grouped.map((g) => g.category)];

  const handleServiceClick = (serviceId: string, serviceName: string) => {
    if (serviceId === SERVICE_IDS.mountTv || serviceName === 'Mount TV') {
      setShowTvModal(true);
      return;
    }
    const service = publicServices.find((s) => s.id === serviceId);
    if (service) {
      onAddToCart({
        id: serviceId,
        name: serviceName,
        price: service.base_price ?? 0,
        quantity: 1,
      });
    }
  };

  const handleTvMountingComplete = (cartItems: CartItem[]) => {
    cartItems.forEach((item) => onAddToCart(item));
    setShowTvModal(false);
  };

  if (isLoading && storefrontServices.length === 0) {
    return (
      <section className="py-10 md:py-20 bg-gradient-to-b from-slate-900 to-slate-800" id="services">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-6 md:mb-10 text-center">Our Services</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 max-w-7xl mx-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-900/80 rounded-xl overflow-hidden border border-slate-700 animate-pulse">
                <div className="w-full aspect-[4/3] bg-slate-700" />
                <div className="p-3 md:p-6 space-y-2">
                  <div className="h-4 bg-slate-700 rounded" />
                  <div className="h-4 bg-slate-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const visibleGroups =
    activeCategory === 'All' ? grouped : grouped.filter((g) => g.category === activeCategory);

  return (
    <section className="py-8 md:py-20 bg-gradient-to-b from-slate-900 to-slate-800" id="services">
      <div className="container mx-auto px-4">
        {/* Compact intro */}
        <div className="text-center mb-4 md:mb-10">
          <h2 className="text-2xl md:text-4xl font-bold text-white">Our Services</h2>
          <p className="hidden md:block text-slate-400 mt-2">
            Professional installation services in Austin, TX
          </p>
        </div>

        {/* Sticky category pills */}
        {availableCategories.length > 2 && (
          <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/80 border-b border-slate-800 mb-4 md:mb-8">
            <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-7xl mx-auto">
              {availableCategories.map((c) => {
                const active = c === activeCategory;
                return (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={`shrink-0 min-h-[36px] px-3 rounded-full text-sm font-medium transition-colors border ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-blue-500 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
          {visibleGroups.map(({ category, items }) => (
            <div key={category}>
              <h3 className="text-lg md:text-2xl font-semibold text-white mb-3 md:mb-5">{category}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {items.map((service) => (
                  <ServiceCard
                    key={service.id}
                    id={service.id}
                    name={service.name}
                    price={service.base_price ?? 0}
                    image={service.image_url || getServiceImage(service.name)}
                    description={service.description || `Professional ${service.name.toLowerCase()} service`}
                    onAddToCart={() => handleServiceClick(service.id, service.name)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showTvModal && (
        <TvMountingModal
          open={showTvModal}
          onClose={() => setShowTvModal(false)}
          onAddToCart={handleTvMountingComplete}
          services={publicServices}
        />
      )}
    </section>
  );
};
