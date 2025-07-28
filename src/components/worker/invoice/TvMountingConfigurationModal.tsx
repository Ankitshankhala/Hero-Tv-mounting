import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
  const [over65, setOver65] = useState(false);
  const [frameMount, setFrameMount] = useState(false);
  const [wallType, setWallType] = useState('standard');
  const [soundbar, setSoundbar] = useState(false);
  const { services } = usePublicServicesData();

  // Initialize with existing configuration
  useEffect(() => {
    if (existingConfiguration) {
      setOver65(existingConfiguration.over65 || false);
      setFrameMount(existingConfiguration.frameMount || false);
      setWallType(existingConfiguration.wallType || 'standard');
      setSoundbar(existingConfiguration.soundbar || false);
    }
  }, [existingConfiguration]);

  const calculatePrice = () => {
    let basePrice = 90; // Base TV mounting price
    let additionalCost = 0;

    if (over65) additionalCost += 50;
    if (frameMount) additionalCost += 75;
    if (wallType !== 'standard') additionalCost += 100;
    if (soundbar) additionalCost += 30;

    return basePrice + additionalCost;
  };

  const handleComplete = () => {
    const configuration = {
      over65,
      frameMount,
      wallType,
      soundbar
    };
    onConfigurationComplete(configuration);
  };

  const wallTypes = [
    { value: 'standard', label: 'Standard (Drywall)', price: 0 },
    { value: 'stone', label: 'Stone Wall', price: 100 },
    { value: 'brick', label: 'Brick Wall', price: 100 },
    { value: 'tile', label: 'Tile Wall', price: 100 }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            Configure TV Mounting Service
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* TV Size Options */}
          <Card className="bg-slate-700 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white">TV Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="over65"
                  checked={over65}
                  onCheckedChange={(checked) => setOver65(checked === true)}
                />
                <label htmlFor="over65" className="text-white cursor-pointer">
                  Over 65" TV
                  <Badge variant="secondary" className="ml-2 bg-slate-600">
                    +$50
                  </Badge>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Mount Type */}
          <Card className="bg-slate-700 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white">Mount Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="frameMount"
                  checked={frameMount}
                  onCheckedChange={(checked) => setFrameMount(checked === true)}
                />
                <label htmlFor="frameMount" className="text-white cursor-pointer">
                  Frame Mount (Premium)
                  <Badge variant="secondary" className="ml-2 bg-slate-600">
                    +$75
                  </Badge>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Wall Type */}
          <Card className="bg-slate-700 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white">Wall Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {wallTypes.map((type) => (
                  <div
                    key={type.value}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      wallType === type.value
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => setWallType(type.value)}
                  >
                    <div className="text-white font-medium">{type.label}</div>
                    {type.price > 0 && (
                      <Badge variant="secondary" className="mt-1 bg-slate-600">
                        +${type.price}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Services */}
          <Card className="bg-slate-700 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white">Additional Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="soundbar"
                  checked={soundbar}
                  onCheckedChange={(checked) => setSoundbar(checked === true)}
                />
                <label htmlFor="soundbar" className="text-white cursor-pointer">
                  Soundbar Mounting
                  <Badge variant="secondary" className="ml-2 bg-slate-600">
                    +$30
                  </Badge>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Price Summary */}
          <Card className="bg-slate-900 border-slate-600">
            <CardHeader>
              <CardTitle className="text-white">Price Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Base TV Mounting:</span>
                  <span>$90.00</span>
                </div>
                {over65 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Over 65" TV:</span>
                    <span>+$50.00</span>
                  </div>
                )}
                {frameMount && (
                  <div className="flex justify-between text-slate-300">
                    <span>Frame Mount:</span>
                    <span>+$75.00</span>
                  </div>
                )}
                {wallType !== 'standard' && (
                  <div className="flex justify-between text-slate-300">
                    <span>{wallTypes.find(t => t.value === wallType)?.label}:</span>
                    <span>+$100.00</span>
                  </div>
                )}
                {soundbar && (
                  <div className="flex justify-between text-slate-300">
                    <span>Soundbar Mounting:</span>
                    <span>+$30.00</span>
                  </div>
                )}
                <div className="border-t border-slate-600 pt-2">
                  <div className="flex justify-between text-white font-bold text-lg">
                    <span>Total:</span>
                    <span>${calculatePrice().toFixed(2)}</span>
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