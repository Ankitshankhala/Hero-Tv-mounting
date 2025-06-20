
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { AuthModal } from '@/components/auth/AuthModal';
import { Footer } from '@/components/Footer';

const Index = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <Header />

      <main className="flex-grow py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-6">
            Your Local TV Mounting Experts
          </h2>
          <p className="text-lg md:text-xl text-slate-300 mb-8">
            Professional TV mounting services with a focus on quality and customer satisfaction.
          </p>

          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
              onClick={() => setShowAuthModal(true)}
            >
              Book Now
            </Button>
            <Link to="/worker-signup">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-slate-900 px-8 py-3"
              >
                Join Our Team
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
};

export default Index;
