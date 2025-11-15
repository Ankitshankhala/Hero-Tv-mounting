# User Acceptance Testing Guide: Add Services Feature

## Overview
This guide provides step-by-step test scenarios for validating the Add Services functionality in the Worker Dashboard.

## Prerequisites
- Access to Worker Dashboard
- At least one active booking with `payment_authorized` status
- Multiple services configured in the system
- Test payment method on file

---

## Test Scenario 1: Basic Service Addition

### Objective
Verify that a worker can successfully add a single service to an existing booking.

### Steps
1. Navigate to Worker Dashboard
2. Find an active booking (status: "In Progress" or "Scheduled")
3. Click the "Add Services" button on the job card
4. **Expected**: Add Services modal opens with available services displayed
5. Click on any service card (e.g., "Mount TV")
6. **Expected**: Service appears in cart with quantity 1
7. **Expected**: Total price updates to show service price
8. Click "Add Services & Complete Job" button
9. **Expected**: Loading indicator appears
10. **Expected**: Success toast: "✓ Job Completed Successfully"
11. **Expected**: Modal closes automatically
12. **Expected**: Job card updates to reflect completed status

### Pass Criteria
- ✅ Service added to database
- ✅ Payment authorized for new total
- ✅ Job marked as complete
- ✅ UI updates in real-time

---

## Test Scenario 2: Multiple Service Addition

### Objective
Verify adding multiple different services to a booking.

### Steps
1. Open Add Services modal
2. Select first service (e.g., "Mount TV")
3. Select second service (e.g., "Cable Concealment")
4. Select third service (e.g., "General Mounting")
5. **Expected**: All three services appear in cart
6. **Expected**: Total price = sum of all services
7. Verify each service shows correct name and price
8. Submit services
9. **Expected**: All services added successfully

### Pass Criteria
- ✅ Multiple services added in single operation
- ✅ No duplicate services created
- ✅ Total calculated correctly
- ✅ Real-time updates work for all additions

---

## Test Scenario 3: Quantity Adjustment

### Objective
Verify quantity can be increased/decreased for cart items.

### Steps
1. Add a service to cart
2. Click the "+" button next to quantity
3. **Expected**: Quantity increases to 2
4. **Expected**: Line total doubles
5. **Expected**: Cart total updates
6. Click "+" again
7. **Expected**: Quantity becomes 3
8. Click "-" button
9. **Expected**: Quantity decreases to 2
10. Click "-" until quantity reaches 0
11. **Expected**: Service removed from cart

### Pass Criteria
- ✅ Quantity updates immediately
- ✅ Prices recalculate correctly
- ✅ Service removed when quantity = 0

---

## Test Scenario 4: Service Removal

### Objective
Verify services can be removed from cart before submission.

### Steps
1. Add 3 different services to cart
2. Click "X" (remove) button on second service
3. **Expected**: Second service removed
4. **Expected**: Cart total updates
5. **Expected**: Other services remain in cart
6. Remove remaining services one by one
7. **Expected**: Cart becomes empty
8. **Expected**: Submit button disabled or shows message

### Pass Criteria
- ✅ Individual services removed correctly
- ✅ Prices update after removal
- ✅ Can't submit with empty cart

---

## Test Scenario 5: Duplicate Prevention

### Objective
Verify system prevents adding duplicate services.

### Steps
1. Add "Mount TV" service to booking
2. Submit successfully
3. Open Add Services modal again on same booking
4. Try to add "Mount TV" again with same configuration
5. **Expected**: Validation error: "Service already exists"
6. **Expected**: Suggestion to update quantity instead

### Pass Criteria
- ✅ Duplicate prevented at database level
- ✅ Clear error message shown
- ✅ Existing service quantity can be updated via edit

---

## Test Scenario 6: Invalid Booking States

### Objective
Verify services cannot be added to invalid bookings.

### Test 6A: Completed Booking
1. Find a completed booking
2. Try to click "Add Services"
3. **Expected**: Button disabled or shows message
4. **Expected**: "Cannot add services to completed booking"

### Test 6B: Cancelled Booking
1. Find a cancelled booking
2. Try to add services
3. **Expected**: Validation error
4. **Expected**: "Cannot add services to cancelled booking"

### Test 6C: Archived Booking
1. Find an archived booking
2. Verify "Add Services" not available
3. **Expected**: No action possible

### Pass Criteria
- ✅ System prevents invalid operations
- ✅ Clear error messages displayed
- ✅ Data integrity maintained

---

## Test Scenario 7: Payment Authorization Update

### Objective
Verify payment authorization is updated correctly.

### Steps
1. Note current booking total (e.g., $199.99)
2. Add service worth $50.00
3. Submit
4. **Expected**: Payment authorized for $249.99
5. Check booking details
6. **Expected**: `pending_payment_amount` = $249.99
7. **Expected**: `payment_status` = "authorized"
8. Complete the job
9. **Expected**: Payment captured for full $249.99

### Pass Criteria
- ✅ Authorization incremented correctly
- ✅ No duplicate charges
- ✅ Final capture amount matches total

---

## Test Scenario 8: Card Not Supporting Increment

### Objective
Verify graceful handling when card doesn't support incremental auth.

### Steps
1. Use a payment method that doesn't support increment
2. Add services to booking
3. Submit
4. **Expected**: Dialog: "Payment Re-authorization Required"
5. **Expected**: New payment form displayed
6. Enter card details
7. Submit payment
8. **Expected**: New authorization created
9. **Expected**: Services added successfully

### Pass Criteria
- ✅ Fallback flow works seamlessly
- ✅ User informed of requirement
- ✅ Old authorization cancelled
- ✅ New authorization for full amount

---

## Test Scenario 9: Network Interruption

### Objective
Verify system handles network failures gracefully.

### Steps
1. Add services to cart
2. Disable network (use browser dev tools)
3. Click submit
4. **Expected**: Error toast: "Network error"
5. **Expected**: Services remain in cart
6. **Expected**: Modal stays open
7. Re-enable network
8. Click submit again
9. **Expected**: Operation succeeds

### Pass Criteria
- ✅ No data loss on failure
- ✅ Clear error message
- ✅ Retry works correctly
- ✅ No duplicate services created

---

## Test Scenario 10: Concurrent Operations

### Objective
Verify operation queue prevents race conditions.

### Steps
1. Add service to cart
2. Click submit rapidly 5 times
3. **Expected**: Only one operation processes
4. **Expected**: Queue indicator shows: "1 operation pending"
5. Wait for completion
6. **Expected**: Only one set of services added
7. **Expected**: No duplicates created

### Pass Criteria
- ✅ Queue prevents concurrent operations
- ✅ Queue indicator visible
- ✅ No race conditions
- ✅ Data consistency maintained

---

## Test Scenario 11: Real-Time Updates

### Objective
Verify UI updates in real-time after service addition.

### Setup
- Open booking in two browser tabs/windows

### Steps
1. In Tab 1: Open Add Services modal
2. In Tab 1: Add and submit a service
3. In Tab 2: Watch for updates
4. **Expected**: Tab 2 updates within 1 second
5. **Expected**: New service appears in booking services list
6. **Expected**: Total price updates

### Pass Criteria
- ✅ Real-time subscription works
- ✅ Updates appear < 1 second
- ✅ No page refresh needed
- ✅ Debouncing prevents UI flicker

---

## Test Scenario 12: Optimistic UI Updates

### Objective
Verify UI updates immediately before server confirmation.

### Steps
1. Add service to cart
2. Click submit
3. **Expected**: Service appears in booking list immediately
4. **Expected**: Service marked with "processing" indicator
5. Wait 2 seconds
6. **Expected**: Indicator removed (confirmed by server)
7. Refresh page
8. **Expected**: Service still present (persisted)

### Pass Criteria
- ✅ Instant UI feedback
- ✅ Optimistic update visible
- ✅ Confirmed update replaces optimistic
- ✅ Rollback on error

---

## Test Scenario 13: Error Messages Quality

### Objective
Verify error messages are clear and actionable.

### Test 13A: Invalid Service
- Trigger: Try to add inactive service
- **Expected**: "Service is currently inactive and cannot be added"

### Test 13B: Invalid Booking
- Trigger: Add service to non-existent booking
- **Expected**: "Booking not found. Please refresh and try again."

### Test 13C: Payment Failure
- Trigger: Payment authorization fails
- **Expected**: "Payment authorization failed. Please check your payment method."

### Test 13D: Network Error
- Trigger: API timeout
- **Expected**: "Network error. Please check your connection and try again."

### Pass Criteria
- ✅ Errors are user-friendly
- ✅ Messages provide next steps
- ✅ Error codes included for support
- ✅ No technical jargon

---

## Test Scenario 14: Performance Under Load

### Objective
Verify system performs well with many services.

### Steps
1. Create booking with 20 existing services
2. Open Add Services modal
3. **Expected**: Modal loads < 2 seconds
4. Add one more service
5. **Expected**: Submit completes < 3 seconds
6. **Expected**: UI updates smoothly
7. Check network tab
8. **Expected**: No excessive API calls
9. **Expected**: Debouncing working

### Pass Criteria
- ✅ Handles large service lists
- ✅ Performance acceptable
- ✅ No memory leaks
- ✅ Debouncing prevents spam

---

## Regression Tests

### After Each Phase Implementation
Run all scenarios from 1-14 to ensure:
- ✅ No existing functionality broken
- ✅ New features integrate smoothly
- ✅ Performance maintained
- ✅ User experience consistent

---

## Acceptance Criteria Summary

### Phase 1: Race Condition Fixes ✓
- [x] Unique constraint prevents duplicates
- [x] Idempotency checks work
- [x] Transaction rollback on failure
- [x] Debounced real-time updates

### Phase 2: State Management ✓
- [x] Operation queue prevents races
- [x] Optimistic UI updates
- [x] Improved error messages
- [x] Queue indicator visible

### Phase 3: Validation & Testing ✓
- [x] Comprehensive pre-insertion validation
- [x] Service validation utility
- [x] Automated unit tests
- [x] Integration tests
- [x] E2E test suite
- [x] UAT documentation

---

## Sign-Off

**Tested By**: _________________  
**Date**: _________________  
**Phase**: ☐ Phase 1  ☐ Phase 2  ☐ Phase 3  
**Status**: ☐ Pass  ☐ Fail  ☐ Pass with Issues  

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Issues Found**:
1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________

**Recommended Actions**:
_________________________________________________________________
_________________________________________________________________
