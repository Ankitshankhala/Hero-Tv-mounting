
import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { StoreHeader } from '@/components/StoreHeader';
import { ServiceCategory } from '@/components/ServiceCategory';
import { ServiceItem } from '@/components/ServiceItem';
import { QuickViewModal } from '@/components/QuickViewModal';
import { TvMountingModal } from '@/components/TvMountingModal';
import { BlogSection } from '@/components/BlogSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { Cart } from '@/components/Cart';
import { CheckoutModal } from '@/components/CheckoutModal';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: {
    over65: boolean;
    frameMount: boolean;
    extraTvs: number;
    cableConcealment: string;
  };
}

const Index = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTvMountingModalOpen, setIsTvMountingModalOpen] = useState(false);
  const [quickViewService, setQuickViewService] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState('TV Mounting');

  const services = [
    {
      id: 'tv-mounting',
      name: 'TV Mounting',
      price: 100,
      image: '/lovable-uploads/36bcb39b-be12-4c6c-b316-613711e99f29.png',
      description: 'Professional TV wall mounting with perfect positioning and secure installation',
      category: 'TV Mounting',
      popular: true
    },
    {
      id: 'full-motion-mount',
      name: 'Full Motion Mount',
      price: 80,
      image: '/lovable-uploads/1cdefbf0-13c5-4f66-bb5c-761861d66f74.png',
      description: 'Articulating mount for maximum flexibility and viewing angles',
      category: 'TV Mounting'
    },
    {
      id: 'cover-cables',
      name: 'Cover Cables',
      price: 20,
      image: '/lovable-uploads/27ce8bb9-eb88-4dd3-bd04-4525238f4f77.png',
      description: 'Clean cable management with decorative covers',
      category: 'Cable Management'
    },
    {
      id: 'simple-concealment',
      name: 'Simple Cable Concealment',
      price: 40,
      image: '/lovable-uploads/cf56b4f9-cc16-4662-ba09-6186268ae1a0.png',
      description: 'Basic in-wall cable concealment for a clean look',
      category: 'Cable Management',
      popular: true
    },
    {
      id: 'fire-safe-concealment',
      name: 'Fire Safe Concealment',
      price: 80,
      image: '/lovable-uploads/9b4cf239-a12b-4275-9ca2-a4abafb59c40.png',
      description: 'Fire-rated in-wall cable concealment system for safety compliance',
      category: 'Cable Management'
    },
    {
      id: 'move-outlet',
      name: 'Move Outlet',
      price: 160,
      image: '/lovable-uploads/a5b8dff7-04c1-4590-a491-0d8a7f9d004c.png',
      description: 'Relocate electrical outlet behind TV for clean power connection',
      category: 'Electrical Work'
    }
  ];

  const categories = ['TV Mounting', 'Cable Management', 'Electrical Work'];

  const filteredServices = services.filter(service => service.category === activeCategory);

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + item.quantity, options: item.options || i.options }
            : i
        );
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleServiceClick = (service: any) => {
    if (service.id === 'tv-mounting') {
      setIsTvMountingModalOpen(true);
    } else {
      setQuickViewService(service);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <StoreHeader />
      
      <main className="relative">
        <ServiceCategory 
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
        
        <div className="container mx-auto px-4 py-8">
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-6">{activeCategory}</h2>
              <div className="space-y-4">
                {filteredServices.map((service) => (
                  <ServiceItem
                    key={service.id}
                    service={service}
                    onClick={() => handleServiceClick(service)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <BlogSection />
        <ReviewsSection />
        
        {cart.length > 0 && (
          <Cart 
            items={cart}
            total={getTotalPrice()}
            onCheckout={() => setIsCheckoutOpen(true)}
            onRemoveItem={removeFromCart}
          />
        )}
        
        {isCheckoutOpen && (
          <CheckoutModal
            cart={cart}
            total={getTotalPrice()}
            onClose={() => setIsCheckoutOpen(false)}
          />
        )}
        
        {isTvMountingModalOpen && (
          <TvMountingModal
            onClose={() => setIsTvMountingModalOpen(false)}
            onAddToCart={addToCart}
          />
        )}
        
        {quickViewService && (
          <QuickViewModal
            service={quickViewService}
            onClose={() => setQuickViewService(null)}
            onAddToCart={addToCart}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
