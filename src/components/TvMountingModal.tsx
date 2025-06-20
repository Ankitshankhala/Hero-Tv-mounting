
import React from 'react';
import { X, Monitor, ArrowRight } from 'lucide-react';
import { CartItem } from '@/types';
import { PublicService } from '@/hooks/usePublicServicesData';
import { useTvMountingModal } from '@/hooks/useTvMountingModal';
import { TvQuantitySelector } from './tv-mounting/TvQuantitySelector';
import { TvAddOns } from './tv-mounting/TvAddOns';
import { WallTypeSelector } from './tv-mounting/WallTypeSelector';
import { ServicesSummary } from './tv-mounting/ServicesSummary';

interface TvMountingModalProps {
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  services: PublicService[];
}

export const TvMountingModal: React.FC<TvMountingModalProps> = ({ 
  open, 
  onClose, 
  onAddToCart, 
  services 
}) => {
  const {
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
  } = useTvMountingModal(services);

  if (!open) {
    return null;
  }

  const incrementTvs = () => {
    if (numberOfTvs < 5) {
      setNumberOfTvs(numberOfTvs + 1);
    }
  };

  const decrementTvs = () => {
    if (numberOfTvs > 1) {
      setNumberOfTvs(numberOfTvs - 1);
    }
  };

  const handleAddToCart = () => {
    const cartItem: CartItem = {
      id: `tv-mounting-configured-${Date.now()}`,
      name: buildCartItemName(),
      price: totalPrice,
      quantity: 1,
      options: {
        over65,
        frameMount,
        numberOfTvs,
        wallType,
        services: buildServicesList()
      }
    };

    onAddToCart(cartItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Monitor className="mr-3 h-6 w-6 text-blue-400" />
              TV Mounting Configuration
            </h2>
            <p className="text-slate-400 mt-1">Customize your TV mounting service</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <TvQuantitySelector
            numberOfTvs={numberOfTvs}
            onIncrement={incrementTvs}
            onDecrement={decrementTvs}
            calculateTvMountingPrice={calculateTvMountingPrice}
          />

          <TvAddOns
            over65={over65}
            setOver65={setOver65}
            frameMount={frameMount}
            setFrameMount={setFrameMount}
            numberOfTvs={numberOfTvs}
            over65Service={over65Service}
            frameMountService={frameMountService}
          />

          <WallTypeSelector
            wallType={wallType}
            setWallType={setWallType}
            numberOfTvs={numberOfTvs}
            stoneWallService={stoneWallService}
          />

          <ServicesSummary
            services={buildServicesList()}
            totalPrice={totalPrice}
          />

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center space-x-2"
            >
              <span>Add to Cart - ${totalPrice}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
