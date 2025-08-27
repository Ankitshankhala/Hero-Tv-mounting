import { supabase } from "@/integrations/supabase/client";

export async function verifyEmailForBooking(bookingId: string) {
  try {
    console.log(`Verifying email for booking ID: ${bookingId}`);
    
    const { data, error } = await supabase.functions.invoke('verify-invoice-emails', {
      body: { booking_ids: [bookingId] }
    });

    if (error) {
      console.error(`Error verifying email for booking ${bookingId}:`, error);
      return { success: false, error: error.message };
    }

    const verification = data.verifications[0];
    
    if (verification.success) {
      console.log(`✅ Email verified for booking ${bookingId}: ${verification.email_address} (${verification.customer_name})`);
    } else {
      console.error(`❌ No valid email for booking ${bookingId}: ${verification.error}`);
    }

    return { success: true, verification };
  } catch (error) {
    console.error(`Exception verifying email for booking ${bookingId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function sendInvoiceForBooking(bookingId: string, skipVerification = false) {
  try {
    // First verify the email address unless skipped
    if (!skipVerification) {
      const verificationResult = await verifyEmailForBooking(bookingId);
      if (!verificationResult.success || !verificationResult.verification?.success) {
        return { 
          success: false, 
          error: `Email verification failed: ${verificationResult.error || verificationResult.verification?.error}`,
          verification: verificationResult.verification
        };
      }
      
      console.log(`Email verified for booking ${bookingId}. Proceeding with invoice generation...`);
    }

    console.log(`Sending invoice for booking ID: ${bookingId}`);
    
    const { data, error } = await supabase.functions.invoke('enhanced-invoice-generator', {
      body: { 
        booking_id: bookingId,
        send_email: true,
        trigger_source: 'manual'
      }
    });

    if (error) {
      console.error(`Error sending invoice for booking ${bookingId}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`Invoice sent successfully for booking ${bookingId}:`, data);
    return { success: true, data };
  } catch (error) {
    console.error(`Exception sending invoice for booking ${bookingId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

// Verify emails first, then send invoices
export async function verifyAndSendInvoicesForBookings() {
  const bookingIds = ['716bffa3', 'c036bceb'];
  
  console.log('Starting email verification for bookings:', bookingIds);
  
  // First, verify all email addresses
  const { data: verificationData, error: verificationError } = await supabase.functions.invoke('verify-invoice-emails', {
    body: { booking_ids: bookingIds }
  });

  if (verificationError) {
    console.error('Failed to verify emails:', verificationError);
    return;
  }

  console.log('Email verification results:');
  verificationData.verifications.forEach((verification: any) => {
    if (verification.success) {
      console.log(`✅ ${verification.booking_id}: ${verification.email_address} (${verification.customer_name}) - ${verification.customer_type} customer`);
    } else {
      console.log(`❌ ${verification.booking_id}: ${verification.error}`);
    }
  });

  // Only send invoices for bookings with valid emails
  const validBookings = verificationData.verifications.filter((v: any) => v.success);
  const invalidBookings = verificationData.verifications.filter((v: any) => !v.success);

  if (invalidBookings.length > 0) {
    console.warn(`⚠️ Skipping ${invalidBookings.length} booking(s) with invalid emails:`, 
      invalidBookings.map((b: any) => b.booking_id));
  }

  if (validBookings.length === 0) {
    console.error('❌ No bookings have valid email addresses. Cannot send invoices.');
    return;
  }

  console.log(`📧 Proceeding to send invoices to ${validBookings.length} booking(s) with valid emails...`);

  // Send invoices for valid bookings
  const results = await Promise.all(
    validBookings.map((verification: any) => 
      sendInvoiceForBooking(verification.booking_id, true) // Skip verification since we already did it
    )
  );
  
  results.forEach((result, index) => {
    const verification = validBookings[index];
    if (result.success) {
      console.log(`✅ Invoice sent successfully for booking ${verification.booking_id} to ${verification.email_address}`);
    } else {
      console.error(`❌ Failed to send invoice for booking ${verification.booking_id}:`, result.error);
    }
  });
  
  return results;
}

// Helper function to validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Export helper function for validation
export { isValidUUID };