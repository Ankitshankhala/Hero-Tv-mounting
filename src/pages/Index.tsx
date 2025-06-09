
import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { ProTipsSection } from '@/components/ProTipsSection';
import { TvMountingModal } from '@/components/TvMountingModal';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: {
    extraTvs: number;
    stoneWork: boolean;
  };
}

const Index = () => {
  const [isTvMountingModalOpen, setIsTvMountingModalOpen] = useState(false);

  const handleBooking = (bookingData: CartItem) => {
    console.log('Booking submitted:', bookingData);
    // Handle booking submission here
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main>
        <HeroSection onOpenModal={() => setIsTvMountingModalOpen(true)} />
        <ReviewsSection />
        <ProTipsSection />
        
        {isTvMountingModalOpen && (
          <TvMountingModal
            onClose={() => setIsTvMountingModalOpen(false)}
            onSubmit={handleBooking}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
