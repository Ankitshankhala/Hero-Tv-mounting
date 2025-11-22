# TV Mounting Pricing Architecture

## Overview
This document describes the centralized pricing system for TV mounting services and add-ons, ensuring consistency between the database, API, and UI.

## Single Source of Truth

The `pricing_config.add_ons` field in the "Mount TV" service record **must always match** the `base_price` of individual add-on services.

### Correct Add-on Prices

| Add-on | pricing_config.add_ons Key | Individual Service Name | Price |
|--------|---------------------------|------------------------|-------|
| Over 65" TV | `over65` | Over 65" TV Add-on | **$25** |
| Frame Mount | `frameMount` | Frame Mount Add-on | **$40** |
| Special Wall | `specialWall` | Brick/Steel/Concrete | **$40** |
| Mount Soundbar | `soundbar` | Mount Soundbar | **$40** |

## Architecture Components

### 1. Database Layer

#### Services Table
- Each add-on is stored as a separate service with `base_price`
- The "Mount TV" service has a `pricing_config` JSONB field containing:
  - `tiers`: Array of tiered pricing for multiple TVs
  - `add_ons`: Object mapping add-on keys to prices

#### Database Trigger
A PostgreSQL trigger (`validate_pricing_consistency()`) runs on every `services` table update to:
- Validate that `pricing_config.add_ons` matches individual service `base_price`
- Log warnings for mismatches
- Create `admin_alerts` for discrepancies

### 2. Application Layer

#### PricingEngine (`src/utils/pricingEngine.ts`)
Centralized pricing logic with:
- `getAddOnPrice()`: Fetches add-on price with consistency validation
- `getTierPrice()`: Calculates tiered base price for multiple TVs
- `calculateTvMountingTotal()`: Complete price breakdown with all add-ons
- `validateAllPricing()`: Admin dashboard validation

#### pricingDisplay (`src/utils/pricingDisplay.ts`)
Helper functions for UI display:
- `formatTieredPricing()`: Format tiered pricing display
- `getAddOnPrice()`: Wrapper around PricingEngine (deprecated, use PricingEngine directly)

### 3. UI Components

#### useTvMountingModal Hook
- Uses `PricingEngine.calculateTvMountingTotal()` for all price calculations
- No hardcoded prices or fallback values
- Validates pricing consistency on every calculation

#### IndividualTvConfig Component
- Displays individual TV configuration options
- Uses `getAddOnPrice()` without default fallbacks
- Shows real-time pricing from database

#### Admin Dashboard - PricingIntegrityMonitor
- Real-time validation of pricing consistency
- Shows mismatches between `pricing_config` and `base_price`
- Auto-sync button to fix inconsistencies
- Last checked timestamp

## Data Flow

```
Database (services table)
    ↓
    ├─ Mount TV service (pricing_config.add_ons)
    └─ Individual add-on services (base_price)
    ↓
PricingEngine (validation & calculation)
    ↓
React Hooks (useTvMountingModal)
    ↓
UI Components (display prices)
    ↓
booking_services table (stored configuration)
```

## Validation & Monitoring

### Automatic Validation
1. **Database Trigger**: Runs on every `services` table update
2. **PricingEngine**: Logs mismatches on every price fetch
3. **Admin Dashboard**: Real-time pricing integrity monitor

### Admin Monitoring
Navigate to Admin Dashboard → Pricing Integrity Monitor to:
- View current pricing consistency status
- See detailed mismatch information
- Auto-sync prices with one click
- Review pricing history

## Updating Prices

### ⚠️ CRITICAL PROCESS
When changing add-on prices, follow these steps **in order**:

1. **Update Individual Service `base_price`**
   ```sql
   UPDATE services 
   SET base_price = 30 
   WHERE name = 'Over 65" TV Add-on';
   ```

2. **Update `pricing_config.add_ons` in Mount TV Service**
   ```sql
   UPDATE services 
   SET pricing_config = jsonb_set(
     pricing_config,
     '{add_ons,over65}',
     '30'::jsonb
   )
   WHERE name = 'Mount TV';
   ```

3. **Verify Consistency in Admin Dashboard**
   - Check Pricing Integrity Monitor
   - Ensure no mismatches are shown
   - Or use Auto-Sync button

### Auto-Sync Alternative
Use the "Auto-Sync Prices" button in the Admin Dashboard, which:
- Fetches all individual service `base_price` values
- Updates `pricing_config.add_ons` to match
- Uses `base_price` as the source of truth

## Historical Context

### Previous Issues (Resolved ✅)
1. **UI showed $50 for Over 65", but charged $25**
   - Root cause: `pricing_config.add_ons.over65` = 50, but `base_price` = 25
   - Impact: Customer confusion, but no revenue loss

2. **UI showed $75 for Frame Mount, but charged $40**
   - Root cause: `pricing_config.add_ons.frameMount` = 75, but `base_price` = 40
   - Impact: Customer confusion, but no revenue loss

3. **Hardcoded fallback values in code**
   - Root cause: Multiple hardcoded price values (50, 75, 30, 40)
   - Impact: Code maintainability and potential future inconsistencies

### Resolution
- Database `pricing_config` updated to match correct `base_price` values
- PricingEngine centralized all pricing logic
- Database trigger prevents future mismatches
- Admin dashboard provides real-time monitoring

## Testing

### Manual Test Cases

1. **Single TV with Over 65" Add-on**
   - Select 1 TV
   - Check "Over 65" TV Add-on"
   - Verify UI shows: Base price + $25
   - Verify `booking_services` stores correct configuration

2. **Multiple TVs with Mixed Add-ons**
   - Select 3 TVs
   - TV 1: Over 65", Frame Mount
   - TV 2: Special Wall, Soundbar
   - TV 3: No add-ons
   - Verify total = (Base price for 3 TVs) + 25 + 40 + 40 + 40

3. **All Add-ons on Single TV**
   - Select 1 TV
   - Check all add-ons
   - Verify total = Base price + 25 + 40 + 40 + 40

4. **Admin Dashboard Pricing Validation**
   - Navigate to Admin Dashboard
   - Check Pricing Integrity Monitor
   - Verify "All prices are consistent" badge

5. **Edge Case: Missing pricing_config**
   - Test graceful degradation if `pricing_config` is null
   - Should fall back to `base_price`

### Automated Test Cases (Future)

```typescript
describe('PricingEngine', () => {
  test('calculates correct price for single TV with Over 65"', () => {
    const result = PricingEngine.calculateTvMountingTotal(
      1,
      [{ id: '1', over65: true, frameMount: false, wallType: 'standard', soundbar: false }],
      tvMountingService,
      { over65: over65Service }
    );
    expect(result.total).toBe(basePrice + 25);
  });

  test('detects pricing mismatches', () => {
    const result = PricingEngine.getAddOnPrice(
      tvMountingServiceWithWrongConfig,
      'over65',
      over65Service
    );
    expect(result.warning).toBeDefined();
  });
});
```

## Troubleshooting

### Issue: UI shows incorrect prices
**Solution**: Check Admin Dashboard → Pricing Integrity Monitor → Click "Auto-Sync Prices"

### Issue: Database trigger not firing
**Solution**: Verify trigger exists:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'check_pricing_consistency';
```

### Issue: PricingEngine logs mismatches
**Solution**: Review `admin_alerts` table:
```sql
SELECT * FROM admin_alerts 
WHERE alert_type = 'pricing_mismatch' 
ORDER BY created_at DESC;
```

## Future Enhancements

1. **Email alerts** for pricing mismatches
2. **Historical pricing audit log**
3. **Automated daily pricing validation job**
4. **Price change approval workflow**
5. **A/B testing for pricing strategies**

## Support

For pricing-related issues:
1. Check Admin Dashboard → Pricing Integrity Monitor
2. Review logs in `admin_alerts` table
3. Contact development team with alert details
