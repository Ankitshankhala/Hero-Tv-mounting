import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import puppeteer from "npm:puppeteer@20.7.4";

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

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; padding: 20px; }
  h1 { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border-bottom: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background: #f0f0f0; }
  .totals { text-align: right; margin-top: 10px; }
</style>
</head>
<body>
  <h1>Hero TV Mounting</h1>
  <h2>Invoice ${booking.invoices?.[0]?.invoice_number || ''}</h2>
  <p><strong>Booking ID:</strong> ${booking.id}</p>
  <p><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString()}</p>
  <p><strong>Customer:</strong> ${booking.customer.name} (${booking.customer.email})</p>
  <p><strong>Worker:</strong> ${booking.worker ? booking.worker.name : 'Unassigned'}</p>
  <table>
    <thead>
      <tr>
        <th>Service</th>
        <th>Qty</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${services.map((s: any) => `
        <tr>
          <td>${s.service_name}</td>
          <td>${s.quantity}</td>
          <td>$${s.base_price.toFixed(2)}</td>
          <td>$${(s.base_price * s.quantity).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="totals">
    <p><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
    <p><strong>Tax:</strong> $${taxAmount.toFixed(2)}</p>
    <p><strong>Total:</strong> $${total.toFixed(2)}</p>
  </div>
</body>
</html>`;

    const pdfBuffer = await generatePdf(html);

    return new Response(pdfBuffer, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
    });
  } catch (err) {
    console.error('Invoice PDF error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generatePdf(html: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return buffer;
}
