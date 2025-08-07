import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PdfRequest {
  booking_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_id }: PdfRequest = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        scheduled_date,
        scheduled_start,
        customer:users!bookings_customer_id_fkey(id, name, email, phone, city, zip_code),
        worker:users!bookings_worker_id_fkey(id, name, email, phone),
        invoices(id, invoice_number, invoice_date, tax_rate, tax_amount, total_amount),
        transactions(id, created_at, processed_at),
        booking_services(service_name, quantity, base_price)
      `)
      .eq('id', booking_id)
      .single();

    if (error || !booking) {
      throw new Error('Booking not found');
    }

    const services = booking.booking_services || [];
    const subtotal = services.reduce((sum: number, s: any) => sum + (s.base_price * (s.quantity || 1)), 0);
    const taxRate = booking.invoices?.[0]?.tax_rate || 0;
    const taxAmount = booking.invoices?.[0]?.tax_amount ?? subtotal * taxRate;
    const total = booking.invoices?.[0]?.total_amount ?? subtotal + taxAmount;

    const paymentDate = booking.transactions?.[0]?.processed_at || booking.transactions?.[0]?.created_at || new Date().toISOString();

    // Create simple PDF content as text for now
    const pdfContent = createSimplePDF({
      invoiceNumber: booking.invoices?.[0]?.invoice_number || '',
      bookingId: booking.id,
      paymentDate: new Date(paymentDate).toLocaleDateString(),
      customer: booking.customer,
      worker: booking.worker,
      services,
      subtotal,
      taxAmount,
      total
    });

    return new Response(pdfContent, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${booking.invoices?.[0]?.invoice_number || booking.id}.pdf"`
      },
    });
  } catch (err) {
    console.error('Invoice PDF error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createSimplePDF(data: any): Uint8Array {
  // Create a simple PDF structure
  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 4 0 R
>>
>>
/MediaBox [0 0 612 792]
/Contents 5 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

5 0 obj
<<
/Length 800
>>
stream
BT
/F1 18 Tf
50 750 Td
(Hero TV Mounting) Tj
0 -30 Td
/F1 14 Tf
(Invoice: ${data.invoiceNumber}) Tj
0 -20 Td
(Booking ID: ${data.bookingId}) Tj
0 -20 Td
(Payment Date: ${data.paymentDate}) Tj
0 -20 Td
(Customer: ${data.customer.name}) Tj
0 -20 Td
(Email: ${data.customer.email}) Tj
0 -30 Td
(Services:) Tj
${data.services.map((s: any, i: number) => `
0 -20 Td
(${s.service_name} - Qty: ${s.quantity} - $${s.base_price.toFixed(2)}) Tj`).join('')}
0 -40 Td
(Subtotal: $${data.subtotal.toFixed(2)}) Tj
0 -20 Td
/F1 16 Tf
(Total: $${data.subtotal.toFixed(2)}) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f 
0000000015 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000259 00000 n 
0000000332 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
1200
%%EOF`;

  return new TextEncoder().encode(pdfHeader);
}
