
import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, Tv } from 'lucide-react';
import { useTvMountingModal } from '@/hooks/useTvMountingModal';

interface TvMountingModalProps {
  open: boolean;
  onClose: () => void;
  onAddToCart: (items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>) => void;
  services: any[];
}

export const TvMountingModal = ({ open, onClose, onAddToCart, services }: TvMountingModalProps) => {
  const {
    numberOfTvs,
    setNumberOfTvs,
    tvConfigurations,
    updateTvConfiguration,
    totalPrice,
    buildServicesList,
    over65Service,
    frameMountService,
    calculateTvMountingPrice,
    isReady,
    servicesLoading,
  } = useTvMountingModal(services);

  const handleAddToCart = () => {
    if (!isReady || servicesLoading) return;
    const servicesList = buildServicesList();
    if (servicesList.length === 0) return;
    onAddToCart(servicesList);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="p-0 gap-0 bg-slate-800 border-slate-700 text-white w-[calc(100vw-1rem)] sm:w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden rounded-xl"
      >
        {/* Sticky header */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700 bg-slate-800 shrink-0 pr-12">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shrink-0">
            <Tv className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base sm:text-lg font-semibold text-white truncate !bg-transparent">
              Mount TV Configuration
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs sm:text-sm truncate">
              Customize your Mount TV service
            </DialogDescription>
          </div>
        </div>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          {/* Number of TVs */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-semibold text-white">Number of TVs</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNumberOfTvs(Math.max(1, numberOfTvs - 1))}
                disabled={numberOfTvs <= 1}
                aria-label="Decrease TVs"
                className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
                  numberOfTvs <= 1
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-14 h-11 bg-slate-700 rounded-lg flex items-center justify-center">
                <span className="text-lg font-semibold text-white">{numberOfTvs}</span>
              </div>
              <button
                onClick={() => setNumberOfTvs(Math.min(5, numberOfTvs + 1))}
                disabled={numberOfTvs >= 5}
                aria-label="Increase TVs"
                className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${
                  numberOfTvs >= 5
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-slate-700/60 rounded-lg px-3 py-2">
              <p className="text-slate-300 text-xs sm:text-sm">
                Base Mount TV: <span className="font-semibold text-white">${calculateTvMountingPrice(numberOfTvs)}</span>
              </p>
              {numberOfTvs > 1 && (
                <div className="text-[11px] sm:text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3">
                  <span>1st: $90</span>
                  <span>2nd: $80</span>
                  {numberOfTvs > 2 && <span>Additional: $70 each</span>}
                </div>
              )}
            </div>
          </section>

          {/* Configure Each TV */}
          <section className="space-y-2">
            <h3 className="text-sm sm:text-base font-semibold text-white">Configure Each TV</h3>
            <div className="space-y-3">
              {tvConfigurations.map((config, index) => (
                <Card key={config.id} className="bg-slate-700/60 border-slate-600">
                  <CardContent className="p-3 sm:p-4">
                    <h4 className="text-sm font-semibold text-white mb-2">TV #{index + 1}</h4>

                    <div className="space-y-2">
                      {[
                        {
                          key: 'over65',
                          checked: config.over65,
                          onChange: (v: boolean) => updateTvConfiguration(config.id, { over65: v }),
                          title: 'Over 65" TV Add-on',
                          desc: `Larger TV surcharge (+$${over65Service?.base_price || 25})`,
                        },
                        {
                          key: 'frameMount',
                          checked: config.frameMount,
                          onChange: (v: boolean) => updateTvConfiguration(config.id, { frameMount: v }),
                          title: 'Frame Mount Add-on',
                          desc: `Specialized frame mounting (+$${frameMountService?.base_price || 25})`,
                        },
                        {
                          key: 'wallType',
                          checked: config.wallType !== 'standard',
                          onChange: (v: boolean) =>
                            updateTvConfiguration(config.id, { wallType: v ? 'steel' : 'standard' }),
                          title: 'Steel/Brick/Concrete Wall',
                          desc: 'Specialty wall surface (+$40)',
                        },
                        {
                          key: 'soundbar',
                          checked: config.soundbar,
                          onChange: (v: boolean) => updateTvConfiguration(config.id, { soundbar: v }),
                          title: 'Mount Soundbar',
                          desc: 'Additional soundbar mounting (+$40)',
                        },
                        {
                          key: 'wireHiding',
                          checked: (config as any).wireHiding,
                          onChange: (v: boolean) => updateTvConfiguration(config.id, { wireHiding: v } as any),
                          title: 'Wire Hiding',
                          desc: 'Conceal wires for a clean look (+$60)',
                        },
                      ].map((opt) => (
                        <label
                          key={opt.key}
                          className="flex items-center gap-3 px-3 min-h-[44px] bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-800/70 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={opt.checked}
                            onChange={(e) => opt.onChange(e.target.checked)}
                            className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 shrink-0"
                          />
                          <div className="flex-1 min-w-0 py-1.5">
                            <div className="text-sm font-medium text-white truncate">{opt.title}</div>
                            <div className="text-xs text-slate-400 truncate">{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-slate-700 bg-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="text-xl sm:text-2xl font-bold text-blue-400">${totalPrice}</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-10 px-4 border-slate-500 text-white bg-slate-700 hover:bg-slate-600 hover:border-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToCart}
              disabled={!isReady}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
