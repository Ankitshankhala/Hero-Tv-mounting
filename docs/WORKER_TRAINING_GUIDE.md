# Worker Training Guide: Adding Services to Bookings

## Welcome!

This guide will teach you how to properly add services to bookings using our new system. The system is designed to prevent errors and provide clear feedback.

## Quick Start

### Step 1: Access the Booking

1. Navigate to your worker dashboard
2. Find the booking you want to modify
3. Click on the booking to view details
4. Click the "Add Services" button

### Step 2: Select Services

1. Browse available services in the modal
2. Click on a service card to add it
3. Configure service options if available
4. Set quantity (default is 1)
5. Review the price calculation

### Step 3: Submit

1. Review your selections in the cart
2. Check the total price
3. Click "Add to Booking"
4. Wait for confirmation

## Understanding the UI

### Service Cards

- **Active Services**: Displayed with full color
- **Disabled Services**: Grayed out with explanation
- **Price**: Shown clearly on each card
- **Configuration**: Click "Configure" if available

### The Cart

- **Service List**: Shows all selected services
- **Quantity**: Click "+/-" to adjust
- **Remove**: Click "X" to remove from cart
- **Total**: Updates automatically
- **Empty Cart**: Use this to start over

### Status Indicators

**Optimistic Updates**:
- Services appear immediately after clicking "Add"
- Marked with subtle indicator
- Confirmed automatically when successful

**Operation Queue**:
- Shows "Processing..." when operation is running
- Displays "1 operation queued" if another is waiting
- Prevents clicking during processing

**Error Messages**:
- Clear description of what went wrong
- Suggestions for how to fix
- Contact info if help is needed

## Common Workflows

### Adding a Single Service

1. Open Add Services modal
2. Click desired service card
3. Configure if needed
4. Click "Add to Booking"
5. Wait for success message

### Adding Multiple Services

1. Open Add Services modal
2. Click first service card
3. Configure and add to cart
4. Click second service card
5. Configure and add to cart
6. Repeat as needed
7. Click "Add to Booking"
8. Wait for confirmation

### Modifying Quantity

1. Select service
2. Add to cart
3. Use "+/-" buttons in cart
4. Or type quantity directly
5. Price updates automatically

### Correcting Mistakes

**Before Submitting**:
- Click "X" to remove from cart
- Click "Clear Cart" to start over
- Close modal to cancel

**After Submitting**:
- Wait for operation to complete
- If error occurs, read the message
- Make corrections
- Try again

## What the System Does Automatically

### Duplicate Prevention

The system prevents adding the same service twice:

- Checks before you submit
- Shows error if service exists
- Suggests updating quantity instead
- Automatically merges duplicates when possible

### Validation

The system validates everything:

- Service must be active
- Booking must be in valid state
- Payment must be authorized
- Quantity must be reasonable
- Price must be valid

### Payment Handling

For bookings requiring payment:

- System calculates new amount
- Updates payment authorization
- Handles Stripe communication
- Shows clear errors if payment fails

### Real-time Sync

Changes sync across devices:

- Other workers see updates
- Customer sees updates
- Admin sees updates
- All in real-time

## Understanding Errors

### "Service already exists"

**What it means**: This service is already in the booking

**What to do**:
1. Check existing services
2. Update quantity instead of adding new
3. Or remove and re-add if needed

### "Booking is not in a valid state"

**What it means**: Booking is archived, cancelled, or completed

**What to do**:
1. Verify booking status
2. Contact admin if status is wrong
3. Don't attempt to modify

### "Payment not authorized"

**What it means**: Booking needs payment authorization first

**What to do**:
1. Check payment status
2. Ensure payment method is saved
3. Contact customer to update payment
4. Contact admin if issues persist

### "Validation failed"

**What it means**: Something about your input is invalid

**What to do**:
1. Read the specific error message
2. Check quantity is reasonable
3. Verify service is configured correctly
4. Try again with corrections

### "Network error" or "Timeout"

**What it means**: Connection problem or slow response

**What to do**:
1. Check your internet connection
2. Wait a moment and try again
3. Refresh the page if persistent
4. Contact admin if continues

## Best Practices

### DO

✅ **Review before submitting**
- Double-check service selection
- Verify quantity is correct
- Confirm price looks right

✅ **Wait for confirmation**
- Don't click multiple times
- Wait for success message
- Check booking updates

✅ **Read error messages**
- They tell you what went wrong
- Follow the suggestions
- Ask for help if unclear

✅ **Monitor queue indicator**
- Wait for operations to complete
- Don't start another immediately
- One at a time is safest

### DON'T

❌ **Don't click repeatedly**
- System queues operations
- Multiple clicks cause confusion
- Be patient

❌ **Don't ignore errors**
- Errors prevent bigger problems
- Fix the issue first
- Don't just retry blindly

❌ **Don't modify archived bookings**
- System prevents this
- Contact admin if needed
- Understand the booking lifecycle

❌ **Don't add without verifying**
- Check booking is correct
- Confirm service is right
- Validate quantity makes sense

## Tips for Success

### Speed

- Use keyboard navigation when possible
- Learn common service configurations
- Keep modal open for multiple additions
- Use quantity buttons efficiently

### Accuracy

- Double-check before clicking submit
- Review cart before adding
- Verify final total matches expectation
- Check booking after operation completes

### Troubleshooting

- Check console if errors persist (F12)
- Note the exact error message
- Document steps to reproduce
- Report systematic issues

### Efficiency

- Batch multiple services together
- Configure before adding to cart
- Use clear cart to start fresh
- Close modal to cancel

## Getting Help

### When to Ask for Help

- Error persists after following guidance
- Unclear error message
- System behaves unexpectedly
- Booking state seems wrong
- Payment authorization fails repeatedly

### What Information to Provide

1. **What you were trying to do**
2. **Exact error message**
3. **Booking ID**
4. **Service name(s)**
5. **When it happened**
6. **Screenshot if possible**

### Who to Contact

- **For booking issues**: Admin dashboard
- **For payment issues**: Admin + accounting
- **For system bugs**: IT support
- **For training**: Your supervisor

## Testing Your Knowledge

Before using the system with real bookings, try these scenarios:

1. Add a single service to a test booking
2. Add multiple services at once
3. Try to add a duplicate service (should fail)
4. Remove a service from cart
5. Clear the cart
6. Cancel without submitting
7. Watch the queue indicator work
8. Read and understand an error message

## Conclusion

The system is designed to:
- Prevent errors before they happen
- Give clear feedback on problems
- Make adding services fast and easy
- Keep data accurate and consistent

Take your time learning it, and you'll find it's more reliable and easier than the old system.

## Quick Reference Card

**Adding Services**: Dashboard → Booking → Add Services → Select → Configure → Add to Booking

**Key Indicators**:
- 🔄 Optimistic: Service just added, confirming
- ⏳ Processing: Operation in progress
- ⚠️ Error: Read message and fix
- ✅ Success: Operation confirmed

**Common Errors**:
- Already exists → Update quantity instead
- Invalid state → Check booking status
- Not authorized → Check payment
- Validation → Check input

**Need Help**: Note error, booking ID, and contact admin

## Additional Resources

- [Service Operations Guide](./SERVICE_OPERATIONS_GUIDE.md) - Technical details
- [Known Limitations](./KNOWN_LIMITATIONS.md) - Current system limits
- [UAT Guide](../tests/USER_ACCEPTANCE_TESTING.md) - Testing procedures
