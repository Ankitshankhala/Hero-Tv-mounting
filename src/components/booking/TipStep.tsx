import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Star, Heart } from 'lucide-react';
import { FormData } from '@/hooks/booking/types';

interface TipStepProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  serviceTotal: number;
}

export const TipStep = ({ formData, setFormData, serviceTotal }: TipStepProps) => {
  const suggestedTips = [
    { percentage: 15, amount: Math.round(serviceTotal * 0.15) },
    { percentage: 18, amount: Math.round(serviceTotal * 0.18) },
    { percentage: 20, amount: Math.round(serviceTotal * 0.20) },
    { percentage: 25, amount: Math.round(serviceTotal * 0.25) }
  ];

  const handleTipChange = (amount: number) => {
    setFormData({
      ...formData,
      tipAmount: amount
    });
  };

  const handleCustomTipChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    setFormData({
      ...formData,
      tipAmount: amount
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <Heart className="h-8 w-8 text-yellow-400" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Show Your Appreciation</h3>
        <p className="text-slate-300">Add a tip to show appreciation for excellent service</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Star className="h-5 w-5 text-yellow-400 mr-2" />
            Suggested Tips
          </CardTitle>
          <CardDescription className="text-slate-300">
            Service Total: ${serviceTotal.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Suggested tip buttons */}
          <div className="grid grid-cols-2 gap-3">
            {suggestedTips.map((tip) => (
              <Button
                key={tip.percentage}
                type="button"
                variant={formData.tipAmount === tip.amount ? "default" : "outline"}
                onClick={() => handleTipChange(tip.amount)}
                className={`h-16 flex flex-col ${
                  formData.tipAmount === tip.amount
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0"
                    : "bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50"
                }`}
              >
                <span className="text-lg font-bold">{tip.percentage}%</span>
                <span className="text-sm">${tip.amount}</span>
              </Button>
            ))}
          </div>

          {/* No tip option */}
          <Button
            type="button"
            variant={formData.tipAmount === 0 ? "default" : "outline"}
            onClick={() => handleTipChange(0)}
            className={`w-full h-12 ${
              formData.tipAmount === 0
                ? "bg-slate-600 text-white border-0"
                : "bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50"
            }`}
          >
            No Tip
          </Button>

          {/* Custom tip input */}
          <div className="space-y-2">
            <Label htmlFor="customTip" className="text-white">Custom Tip Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="customTip"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.tipAmount > 0 && !suggestedTips.some(tip => tip.amount === formData.tipAmount) ? formData.tipAmount : ''}
                onChange={(e) => handleCustomTipChange(e.target.value)}
                className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Total display */}
          <div className="pt-4 border-t border-slate-600">
            <div className="flex justify-between text-lg font-semibold text-white">
              <span>Total with Tip:</span>
              <span>${(serviceTotal + formData.tipAmount).toFixed(2)}</span>
            </div>
            {formData.tipAmount > 0 && (
              <p className="text-sm text-slate-300 mt-1">
                Includes ${formData.tipAmount.toFixed(2)} tip
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};