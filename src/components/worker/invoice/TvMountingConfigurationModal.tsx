import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TvQuantitySelector } from '@/components/tv-mounting/TvQuantitySelector';
import { IndividualTvConfig } from '@/components/tv-mounting/IndividualTvConfig';
import { useTvMountingModal } from '@/hooks/useTvMountingModal';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';

interface TvMountingConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigurationComplete: (configuration: any) => void;
  existingConfiguration?: any;
}

export const TvMountingConfigurationModal: React.FC<TvMountingConfigurationModalProps> = ({
  isOpen,
  onClose,
  onConfigurationComplete,
  existingConfiguration = {}
}) => {
  const { services } = usePublicServicesData();
  
  const {
    numberOfTvs,
    setNumberOfTvs,
    tvConfigurations,
    updateTvConfiguration,
    over65Service,
    frameMountService,
    stoneWallService,
    totalPrice,
    calculateTvMountingPrice,
    buildServicesList,
    buildCartItemName
  } = useTvMountingModal(services);

  // Initialize with existing configuration
  useEffect(() => {
    if (existingConfiguration) {
      // If existing config has TV configurations, restore them
      if (existingConfiguration.numberOfTvs) {
        setNumberOfTvs(existingConfiguration.numberOfTvs);
      }
      
      // Update individual TV configurations if they exist
      if (existingConfiguration.tvConfigurations) {
        existingConfiguration.tvConfigurations.forEach((config: any, index: number) => {
          updateTvConfiguration((index + 1).toString(), {
            over65: config.over65 || false,
            frameMount: config.frameMount || false,
            wallType: config.wallType || 'standard',
            soundbar: config.soundbar || false
          });
        });
      } else {
        // Legacy format - single TV configuration
        updateTvConfiguration('1', {
          over65: existingConfiguration.over65 || false,
          frameMount: existingConfiguration.frameMount || false,
          wallType: existingConfiguration.wallType || 'standard',
          soundbar: existingConfiguration.soundbar || false
        });
      }
    }
  }, [existingConfiguration, setNumberOfTvs, updateTvConfiguration]);

  const handleComplete = () => {
    const configuration = {
      numberOfTvs,
      tvConfigurations,
      totalPrice,
      services: buildServicesList(),
      cartItemName: buildCartItemName()
    };
    onConfigurationComplete(configuration);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold">📺</span>
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                Configure TV Mounting Service
              </DialogTitle>
              <p className="text-slate-400 text-sm">Customize your TV mounting service for each TV</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* TV Quantity Selector */}
          <TvQuantitySelector
            numberOfTvs={numberOfTvs}
            onIncrement={() => setNumberOfTvs(Math.min(5, numberOfTvs + 1))}
            onDecrement={() => setNumberOfTvs(Math.max(1, numberOfTvs - 1))}
            calculateTvMountingPrice={calculateTvMountingPrice}
          />

          {/* Configure Each TV */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Configure Each TV</h3>
            {tvConfigurations.map((config, index) => (
              <IndividualTvConfig
                key={config.id}
                tvConfig={config}
                tvNumber={index + 1}
                onUpdateConfig={updateTvConfiguration}
                over65Service={over65Service}
                frameMountService={frameMountService}
                stoneWallService={stoneWallService}
              />
            ))}
          </div>

          {/* Services Summary */}
          <Card className="bg-slate-900 border-slate-600">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Services Summary</h3>
              <div className="space-y-2">
                {buildServicesList().map((service, index) => (
                  <div key={index} className="flex justify-between text-slate-300">
                    <span>{service.name}</span>
                    <span>${service.price.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-600 pt-2 mt-3">
                  <div className="flex justify-between text-white font-bold text-xl">
                    <span>Total:</span>
                    <span className="text-green-400">${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Apply Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};