import { supabase } from "@/integrations/supabase/client";

export async function sendInvoiceForBooking(bookingId: string) {
  try {
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

// Send invoices for specific booking IDs
export async function sendInvoicesForBookings() {
  const bookingIds = ['716bffa3', 'c036bceb'];
  
  console.log('Starting to send invoices for bookings:', bookingIds);
  
  const results = await Promise.all(
    bookingIds.map(bookingId => sendInvoiceForBooking(bookingId))
  );
  
  results.forEach((result, index) => {
    const bookingId = bookingIds[index];
    if (result.success) {
      console.log(`✅ Invoice sent successfully for booking ${bookingId}`);
    } else {
      console.error(`❌ Failed to send invoice for booking ${bookingId}:`, result.error);
    }
  });
  
  return results;
}

// Auto-execute when this file is imported
sendInvoicesForBookings().then(() => {
  console.log('All invoice sending attempts completed');
}).catch(error => {
  console.error('Error in batch invoice sending:', error);
});