import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { z } from 'zod';

// Validation schemas
const tierSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().min(0, 'Price must be non-negative'),
  is_default_for_additional: z.boolean().optional()
});

const addOnSchema = z.record(z.string(), z.number().min(0, 'Add-on price must be non-negative'));

const pricingConfigSchema = z.object({
  pricing_type: z.enum(['simple', 'tiered']),
  tiers: z.array(tierSchema).optional(),
  add_ons: addOnSchema.optional()
});

export type PricingConfig = z.infer<typeof pricingConfigSchema>;

interface PricingConfigEditorProps {
  config: PricingConfig | null;
  onChange: (config: PricingConfig | null) => void;
  serviceName: string;
}

export const PricingConfigEditor: React.FC<PricingConfigEditorProps> = ({
  config,
  onChange,
  serviceName
}) => {
  const [enabled, setEnabled] = useState(!!config);
  const [pricingType, setPricingType] = useState<'simple' | 'tiered'>(
    config?.pricing_type || 'simple'
  );
  const [tiers, setTiers] = useState<Array<{ quantity: number; price: number; is_default_for_additional?: boolean }>>(
    (config?.tiers || []).map(tier => ({
      quantity: tier.quantity,
      price: tier.price,
      is_default_for_additional: tier.is_default_for_additional
    }))
  );
  const [addOns, setAddOns] = useState<Record<string, number>>(
    config?.add_ons || {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Suggest common add-ons for TV mounting service
  const suggestedAddOns = serviceName.toLowerCase().includes('tv') || serviceName.toLowerCase().includes('mount')
    ? ['over65', 'frameMount', 'specialWall', 'soundbar']
    : [];

  useEffect(() => {
    if (enabled) {
      validateAndUpdate();
    } else {
      onChange(null);
    }
  }, [enabled, pricingType, tiers, addOns]);

  const validateAndUpdate = () => {
    try {
      const newErrors: Record<string, string> = {};

      // Validate tiers if tiered pricing
      if (pricingType === 'tiered' && tiers.length > 0) {
        tiers.forEach((tier, index) => {
          try {
            tierSchema.parse(tier);
          } catch (e) {
            if (e instanceof z.ZodError) {
              newErrors[`tier_${index}`] = e.errors[0].message;
            }
          }
        });

        // Check for duplicate quantities
        const quantities = tiers.map(t => t.quantity);
        const duplicates = quantities.filter((q, i) => quantities.indexOf(q) !== i);
        if (duplicates.length > 0) {
          newErrors['tiers'] = `Duplicate quantities found: ${duplicates.join(', ')}`;
        }

        // Ensure at least one tier has is_default_for_additional
        const hasDefault = tiers.some(t => t.is_default_for_additional);
        if (!hasDefault && tiers.length > 0) {
          newErrors['tiers_default'] = 'At least one tier must be marked as default for additional quantities';
        }
      }

      // Validate add-ons
      Object.entries(addOns).forEach(([key, value]) => {
        if (value < 0) {
          newErrors[`addon_${key}`] = 'Price must be non-negative';
        }
        if (!key.trim()) {
          newErrors['addon_key'] = 'Add-on name cannot be empty';
        }
      });

      setErrors(newErrors);

      if (Object.keys(newErrors).length === 0) {
        const configData: PricingConfig = {
          pricing_type: pricingType,
          ...(pricingType === 'tiered' && tiers.length > 0 ? { tiers } : {}),
          ...(Object.keys(addOns).length > 0 ? { add_ons: addOns } : {})
        };
        
        onChange(configData);
      }
    } catch (e) {
      console.error('Validation error:', e);
    }
  };

  const addTier = () => {
    const nextQuantity = tiers.length > 0 
      ? Math.max(...tiers.map(t => t.quantity)) + 1 
      : 1;
    setTiers([...tiers, { quantity: nextQuantity, price: 0, is_default_for_additional: false }]);
  };

  const updateTier = (index: number, field: keyof typeof tiers[0], value: number | boolean) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    
    // If marking this as default, unmark others
    if (field === 'is_default_for_additional' && value === true) {
      newTiers.forEach((tier, i) => {
        if (i !== index) tier.is_default_for_additional = false;
      });
    }
    
    setTiers(newTiers);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const addAddOn = (key?: string) => {
    const newKey = key || `addon_${Object.keys(addOns).length + 1}`;
    if (!addOns[newKey]) {
      setAddOns({ ...addOns, [newKey]: 0 });
    }
  };

  const updateAddOnKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const { [oldKey]: value, ...rest } = addOns;
    setAddOns({ ...rest, [newKey]: value });
  };

  const updateAddOnValue = (key: string, value: number) => {
    setAddOns({ ...addOns, [key]: Math.max(0, value) });
  };

  const removeAddOn = (key: string) => {
    const { [key]: _, ...rest } = addOns;
    setAddOns(rest);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Advanced Pricing Configuration</CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="enable-pricing-config" className="text-sm">Enable</Label>
            <Switch
              id="enable-pricing-config"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-6">
          {/* Pricing Type Selector */}
          <div className="space-y-2">
            <Label>Pricing Type</Label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="simple"
                  checked={pricingType === 'simple'}
                  onChange={(e) => setPricingType(e.target.value as 'simple' | 'tiered')}
                  className="text-primary"
                />
                <span>Simple (Base Price Only)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="tiered"
                  checked={pricingType === 'tiered'}
                  onChange={(e) => setPricingType(e.target.value as 'simple' | 'tiered')}
                  className="text-primary"
                />
                <span>Tiered (Quantity-based)</span>
              </label>
            </div>
          </div>

          {/* Tiered Pricing Configuration */}
          {pricingType === 'tiered' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Pricing Tiers</Label>
                <Button type="button" size="sm" onClick={addTier} variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tier
                </Button>
              </div>

              {errors['tiers'] && (
                <div className="flex items-center text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors['tiers']}
                </div>
              )}

              {errors['tiers_default'] && (
                <div className="flex items-center text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors['tiers_default']}
                </div>
              )}

              {tiers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No tiers defined. Add at least one tier to enable tiered pricing.
                </p>
              )}

              <div className="space-y-2">
                {tiers.map((tier, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.quantity}
                          onChange={(e) => updateTier(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Price ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.price}
                          onChange={(e) => updateTier(index, 'price', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-1 cursor-pointer text-xs whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={tier.is_default_for_additional || false}
                          onChange={(e) => updateTier(index, 'is_default_for_additional', e.target.checked)}
                          className="h-3 w-3"
                        />
                        <span>Default</span>
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTier(index)}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {errors[`tier_${index}`] && (
                      <span className="text-xs text-destructive">{errors[`tier_${index}`]}</span>
                    )}
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground">
                Mark one tier as "Default" to use its price for quantities beyond defined tiers.
              </p>
            </div>
          )}

          {/* Add-ons Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Add-ons</Label>
              <Button type="button" size="sm" onClick={() => addAddOn()} variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Custom
              </Button>
            </div>

            {/* Suggested add-ons */}
            {suggestedAddOns.length > 0 && Object.keys(addOns).length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Suggested add-ons:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedAddOns.map(addon => (
                    <Button
                      key={addon}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => addAddOn(addon)}
                    >
                      {addon}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(addOns).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No add-ons defined. Add-ons are optional pricing modifiers.
              </p>
            )}

            <div className="space-y-2">
              {Object.entries(addOns).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Add-on Name</Label>
                      <Input
                        value={key}
                        onChange={(e) => updateAddOnKey(key, e.target.value)}
                        placeholder="e.g., over65"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={value}
                        onChange={(e) => updateAddOnValue(key, parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeAddOn(key)}
                    className="h-8 w-8 p-0 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {errors[`addon_${key}`] && (
                    <span className="text-xs text-destructive">{errors[`addon_${key}`]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start space-x-2 text-destructive">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Please fix validation errors:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.values(errors).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
