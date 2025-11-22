# TV Mounting Pricing Fix - Testing Guide

## Overview
This guide provides comprehensive test cases to validate the pricing fix for TV mounting services and add-ons.

## Pre-Test Validation

### 1. Verify Database Migration
```sql
-- Check that pricing_config has been updated
SELECT name, pricing_config->'add_ons' as add_ons 
FROM services 
WHERE name = 'Mount TV';

-- Expected result:
-- add_ons: {"over65": 25, "frameMount": 40, "soundbar": 40, "specialWall": 40}

-- Check individual service prices
SELECT name, base_price 
FROM services 
WHERE name IN (
  'Over 65" TV Add-on', 
  'Frame Mount Add-on', 
  'Mount Soundbar',
  'Steel/Brick/Concrete Wall'
);

-- Expected results:
-- Over 65" TV Add-on: 25
-- Frame Mount Add-on: 40
-- Mount Soundbar: 40
```

### 2. Verify Database Trigger
```sql
-- Check trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'check_pricing_consistency';

-- Expected: check_pricing_consistency on services table
```

## Test Cases

### Test Case 1: Single TV with Over 65" Add-on ✅

**Steps:**
1. Navigate to booking page
2. Click "Mount TV" service
3. Select 1 TV
4. Check "Over 65" TV Add-on" checkbox
5. Verify displayed price

**Expected Results:**
- UI shows: Base price + $25
- Total should match: (1st TV base price) + $25
- Example: If base is $90, total should be $115

**Validation Points:**
- [ ] UI displays "+$25" next to Over 65" checkbox
- [ ] Total price increases by $25 when checked
- [ ] Total price decreases by $25 when unchecked

### Test Case 2: Single TV with Frame Mount Add-on ✅

**Steps:**
1. Navigate to booking page
2. Click "Mount TV" service
3. Select 1 TV
4. Check "Frame Mount Add-on" checkbox
5. Verify displayed price

**Expected Results:**
- UI shows: Base price + $40
- Total should match: (1st TV base price) + $40
- Example: If base is $90, total should be $130

**Validation Points:**
- [ ] UI displays "+$40" next to Frame Mount checkbox
- [ ] Total price increases by $40 when checked
- [ ] Total price decreases by $40 when unchecked

### Test Case 3: Single TV with All Add-ons ✅

**Steps:**
1. Navigate to booking page
2. Click "Mount TV" service
3. Select 1 TV
4. Check all add-ons:
   - Over 65" TV Add-on
   - Frame Mount Add-on
   - Steel/Brick/Concrete Wall
   - Mount Soundbar
5. Verify displayed price

**Expected Results:**
- UI shows: Base price + $25 + $40 + $40 + $40 = Base + $145
- Example: If base is $90, total should be $235

**Validation Points:**
- [ ] UI displays correct individual prices for each add-on
- [ ] Total = Base + 25 + 40 + 40 + 40
- [ ] Unchecking any add-on updates total correctly

### Test Case 4: Multiple TVs (3) with Different Configurations ✅

**Steps:**
1. Navigate to booking page
2. Click "Mount TV" service
3. Select 3 TVs
4. Configure:
   - TV #1: Over 65", Frame Mount
   - TV #2: Special Wall, Soundbar
   - TV #3: No add-ons
5. Verify displayed price

**Expected Results:**
- Base price for 3 TVs (tiered pricing)
- TV #1 add-ons: +$25 + $40 = +$65
- TV #2 add-ons: +$40 + $40 = +$80
- TV #3 add-ons: $0
- Total add-ons: $145

**Example Calculation (assuming tiered base prices):**
- 1st TV: $90
- 2nd TV: $80
- 3rd TV: $70
- Base total: $240
- Add-ons: $145
- **Grand Total: $385**

**Validation Points:**
- [ ] Each TV shows individual configuration
- [ ] Total updates correctly when changing any TV's config
- [ ] Price breakdown is displayed clearly

### Test Case 5: Booking Creation and Database Storage ✅

**Steps:**
1. Complete a booking with 2 TVs:
   - TV #1: Over 65", Soundbar
   - TV #2: Frame Mount, Special Wall
2. Complete booking process
3. Verify database records

**Database Validation:**
```sql
-- Check booking_services table
SELECT 
  bs.service_name,
  bs.base_price,
  bs.quantity,
  bs.configuration
FROM booking_services bs
JOIN bookings b ON b.id = bs.booking_id
WHERE b.id = 'YOUR_BOOKING_ID'
ORDER BY bs.created_at;

-- Expected records:
-- 1. Mount TV: base_price=(base for 2 TVs), configuration={}
-- 2. Over 65" TV Add-on: base_price=25, quantity=1
-- 3. Mount Soundbar: base_price=40, quantity=1
-- 4. Frame Mount Add-on: base_price=40, quantity=1
-- 5. Steel/Brick/Concrete Wall: base_price=40, quantity=1
```

**Validation Points:**
- [ ] All services stored correctly
- [ ] base_price matches expected values
- [ ] configuration fields are correct
- [ ] Total booking amount matches UI display

### Test Case 6: Admin Dashboard - Pricing Integrity Monitor ✅

**Steps:**
1. Log in as admin
2. Navigate to Admin Dashboard
3. Scroll to "Pricing Integrity Monitor" section
4. Verify status

**Expected Results:**
- Status shows: "All prices are consistent" with green checkmark
- No mismatches displayed
- Last checked timestamp is recent

**Validation Points:**
- [ ] Monitor loads without errors
- [ ] Status badge is green
- [ ] No pricing alerts shown
- [ ] Refresh button works

### Test Case 7: Price Mismatch Detection (Intentional Error) ⚠️

**Purpose:** Verify the monitoring system detects inconsistencies

**Steps:**
1. As admin, manually update pricing_config:
```sql
UPDATE services 
SET pricing_config = jsonb_set(
  pricing_config,
  '{add_ons,over65}',
  '99'::jsonb
)
WHERE name = 'Mount TV';
```

2. Refresh Admin Dashboard
3. Check Pricing Integrity Monitor

**Expected Results:**
- Status shows: "1 pricing mismatch(es) detected" with red X icon
- Alert details show:
  - Service: "Over 65" TV Add-on"
  - pricing_config: $99
  - base_price: $25
- Auto-Sync button appears

**Validation Points:**
- [ ] Mismatch is detected immediately
- [ ] Alert provides clear details
- [ ] Auto-Sync button is available

**Cleanup:**
```sql
-- Restore correct pricing
UPDATE services 
SET pricing_config = jsonb_set(
  pricing_config,
  '{add_ons,over65}',
  '25'::jsonb
)
WHERE name = 'Mount TV';
```

### Test Case 8: Auto-Sync Functionality ✅

**Prerequisites:** Complete Test Case 7 first (intentional mismatch)

**Steps:**
1. With pricing mismatch present
2. Click "Auto-Sync Prices" button
3. Wait for sync completion
4. Verify status updates

**Expected Results:**
- Success toast: "Pricing Synchronized"
- Status updates to: "All prices are consistent"
- Mismatch alert disappears

**Database Verification:**
```sql
SELECT pricing_config->'add_ons' 
FROM services 
WHERE name = 'Mount TV';

-- Should show all correct prices: 25, 40, 40, 40
```

**Validation Points:**
- [ ] Sync completes without errors
- [ ] Database is updated correctly
- [ ] UI reflects changes immediately

### Test Case 9: Historical Booking Validation (Optional) 📊

**Purpose:** Verify past bookings used correct prices

**Steps:**
1. Query recent bookings:
```sql
SELECT 
  b.id,
  b.created_at,
  bs.service_name,
  bs.base_price,
  bs.quantity
FROM bookings b
JOIN booking_services bs ON bs.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '30 days'
  AND bs.service_name IN (
    'Over 65" TV Add-on',
    'Frame Mount Add-on',
    'Mount Soundbar',
    'Steel/Brick/Concrete Wall'
  )
ORDER BY b.created_at DESC;
```

2. Verify prices match:
   - Over 65": $25
   - Frame Mount: $40
   - Soundbar: $40
   - Special Wall: $40

**Expected Results:**
- All historical bookings show correct base_price values
- No refunds needed (customers were charged correctly)

### Test Case 10: Edge Cases ⚠️

#### 10.1: Missing pricing_config
**Test:** Temporarily remove pricing_config from Mount TV service
**Expected:** Should gracefully fall back to individual service base_price

#### 10.2: Missing Individual Service
**Test:** Temporarily deactivate "Over 65" TV Add-on" service
**Expected:** PricingEngine should log warning, return price=0

#### 10.3: Very Large Order (10 TVs with all add-ons)
**Test:** Configure 10 TVs, each with all 4 add-ons
**Expected:** 
- UI should handle large numbers correctly
- Total = (Base for 10 TVs) + (10 × $145) = Base + $1,450
- No performance issues

## Performance Validation

### Response Time Benchmarks
- [ ] TV mounting modal opens < 1 second
- [ ] Price calculation updates < 100ms
- [ ] Admin dashboard loads < 2 seconds
- [ ] Booking submission < 3 seconds

## Browser Compatibility
Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Regression Testing

### Areas to Verify Unchanged
- [ ] Other services (non-TV mounting) still work
- [ ] Existing bookings display correctly
- [ ] Payment processing unaffected
- [ ] Email notifications unchanged
- [ ] Worker dashboard unaffected

## Success Criteria

All test cases must pass:
- ✅ UI displays correct prices ($25, $40, $40, $40)
- ✅ Database stores correct prices
- ✅ Calculations match between UI and database
- ✅ Admin monitoring detects mismatches
- ✅ Auto-sync resolves inconsistencies
- ✅ No performance degradation
- ✅ Historical data remains accurate

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| QA Engineer | | | ☐ Pass / ☐ Fail |
| Developer | | | ☐ Pass / ☐ Fail |
| Product Manager | | | ☐ Approved |

## Notes
Use this space to document any issues found during testing:

---

## Quick Reference: Correct Prices

| Add-on | Old UI Price (Incorrect) | Correct Price | Status |
|--------|-------------------------|---------------|--------|
| Over 65" TV | ~~$50~~ | **$25** | ✅ Fixed |
| Frame Mount | ~~$75~~ | **$40** | ✅ Fixed |
| Mount Soundbar | ~~$30~~ | **$40** | ✅ Fixed |
| Special Wall | $40 | **$40** | ✅ Correct |
