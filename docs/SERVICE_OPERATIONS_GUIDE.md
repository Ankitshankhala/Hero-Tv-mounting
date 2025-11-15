# Service Operations Guide

## Overview

This guide documents the service operations system for adding, updating, and removing services from bookings. It covers the architecture, monitoring, troubleshooting, and best practices.

## System Architecture

### Components

1. **Frontend Components**
   - `AddServicesModal.tsx` - User interface for adding services
   - `ServiceOperationsMonitor.tsx` - Admin dashboard for monitoring operations
   - `OperationQueueIndicator.tsx` - Visual feedback for queued operations

2. **Hooks**
   - `useRealTimeInvoiceOperations.tsx` - Manages service CRUD operations with optimistic UI
   - `useOperationQueue.ts` - Queues operations to prevent race conditions
   - `useServiceOperationTracking.ts` - Tracks operations for analytics

3. **Utilities**
   - `serviceValidation.ts` - Comprehensive validation before operations
   - `servicesMonitoring.ts` - Performance and error tracking
   - `logger.ts` - Centralized logging utility

4. **Edge Functions**
   - `add-booking-services` - Server-side service addition with payment handling

5. **Database**
   - `booking_services` - Stores service line items
   - `service_operation_logs` - Tracks all operations for analytics
   - `v_service_operation_analytics` - Aggregated analytics view

## Key Features

### 1. Duplicate Prevention

The system prevents duplicate services through multiple mechanisms:

- **Pre-insertion validation**: Checks for existing services before adding
- **Idempotency**: Edge function checks use idempotency keys
- **Configuration matching**: Services with identical configuration are merged

### 2. Optimistic UI Updates

All operations show immediate feedback:

- Services appear instantly in the UI
- Marked as "optimistic" until server confirms
- Reverted automatically on errors
- Real data replaces optimistic on success

### 3. Operation Queue

Operations are queued to prevent conflicts:

- Only one operation runs at a time
- Additional operations wait in queue
- User sees queue status indicator
- Toast notifications for queue events

### 4. Comprehensive Validation

Multi-layer validation ensures data integrity:

**Schema Validation**:
- Service ID must be valid UUID
- Name length 1-100 characters
- Base price positive, max $10,000
- Quantity 1-100
- Configuration is valid JSON

**Database Validation**:
- Service exists and is active
- Booking is not archived/cancelled/completed
- Payment is authorized
- No duplicate services

### 5. Real-time Updates

Changes sync across sessions:

- Debounced real-time subscriptions (300ms)
- Automatic UI refresh on changes
- Prevents rapid redundant updates
- Maintains consistency across users

### 6. Comprehensive Logging

All operations are tracked:

- Success/failure status
- Duration metrics
- Error details
- Retry attempts
- Worker and booking associations

## Common Issues & Solutions

### Issue: "Service already exists"

**Cause**: Attempting to add a service that's already in the booking

**Solution**:
1. Check existing services in the booking
2. Use update quantity instead of adding new
3. System automatically merges duplicates

**Prevention**: Pre-insertion validation catches this before database call

### Issue: "Booking is not in a valid state"

**Cause**: Attempting to modify an archived, cancelled, or completed booking

**Solution**:
1. Verify booking status is valid
2. Only add services to active bookings
3. Check payment authorization status

**Prevention**: Validation blocks operations on invalid bookings

### Issue: "Payment not authorized"

**Cause**: Booking requires payment authorization first

**Solution**:
1. Ensure payment intent is created
2. Verify payment status is authorized
3. Check Stripe dashboard for payment status

**Prevention**: Validation checks payment status before allowing additions

### Issue: Slow Operations (>3s)

**Cause**: Network latency, database performance, or Stripe API delays

**Solution**:
1. Check network connectivity
2. Review database query performance
3. Verify Stripe API response times
4. Check server logs for bottlenecks

**Monitoring**: System alerts on operations >3 seconds

### Issue: Operation Queue Stuck

**Cause**: Failed operation not properly cleaned up

**Solution**:
1. Refresh the page to reset queue
2. Check console for error messages
3. Review operation logs in admin dashboard

**Prevention**: Proper error handling and cleanup in queue

## Best Practices

### For Workers

1. **Always validate before adding**
   - Check if service already exists
   - Verify booking is in correct state
   - Ensure payment is authorized

2. **Use the UI feedback**
   - Watch for optimistic indicators
   - Wait for operation queue to clear
   - Check for error toasts

3. **Handle errors gracefully**
   - Read error messages carefully
   - Don't retry immediately on failure
   - Report persistent issues to admin

4. **Monitor performance**
   - Watch for slow operations
   - Report systematic issues
   - Check network connection

### For Admins

1. **Regular Monitoring**
   - Check admin dashboard daily
   - Review failed operations
   - Monitor success rates
   - Track performance metrics

2. **Investigate Failures**
   - Review error patterns
   - Check for systematic issues
   - Verify Stripe integration
   - Test database connectivity

3. **Performance Optimization**
   - Monitor average duration
   - Identify slow operations
   - Review database indexes
   - Optimize queries as needed

4. **Data Integrity**
   - Regularly check for anomalies
   - Verify billing accuracy
   - Audit service additions
   - Reconcile with Stripe

## Monitoring & Analytics

### Admin Dashboard

Access: `/admin/service-operations`

**Metrics Displayed**:
- Total operations (24h)
- Success rate percentage
- Average operation duration
- Failed operations count

**Failed Operations Tab**:
- Lists all failed operations
- Shows error codes and messages
- Displays retry counts
- Technical details available

**Recent Operations Tab**:
- Last 100 operations
- All statuses included
- Real-time updates
- Quick status overview

**Analytics Tab**:
- Hourly aggregated data
- Performance trends
- Worker activity
- Retry statistics

### Database Queries

**View Failed Operations**:
```sql
SELECT *
FROM service_operation_logs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

**Calculate Success Rate**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*) as success_rate
FROM service_operation_logs
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Find Slow Operations**:
```sql
SELECT *
FROM service_operation_logs
WHERE duration_ms > 3000
ORDER BY duration_ms DESC;
```

**Worker Performance**:
```sql
SELECT 
  worker_id,
  COUNT(*) as total_ops,
  AVG(duration_ms) as avg_duration,
  COUNT(*) FILTER (WHERE status = 'success') as successful_ops
FROM service_operation_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY worker_id;
```

## Known Limitations

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for detailed list of current system limitations and planned improvements.

## Support

For issues or questions:

1. Check this documentation first
2. Review error logs in admin dashboard
3. Check browser console for errors
4. Contact system administrator
5. Submit bug report with:
   - Error message
   - Steps to reproduce
   - Booking ID
   - Timestamp
   - Browser/device info

## Related Documentation

- [Worker Training Guide](./WORKER_TRAINING_GUIDE.md)
- [Known Limitations](./KNOWN_LIMITATIONS.md)
- [User Acceptance Testing](../tests/USER_ACCEPTANCE_TESTING.md)
