import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting email test...');
    
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    console.log('API Key available:', !!resendApiKey);
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not found in environment');
    }

    // Import and initialize Resend
    const { Resend } = await import("npm:resend@2.0.0");
    const resend = new Resend(resendApiKey);
    
    console.log('📧 Attempting to send test email...');
    
    const result = await resend.emails.send({
      from: 'Hero TV Mounting <noreply@herotvmounting.com>',
      to: ['kuhuwebconnect@gmail.com'],
      subject: 'Test Email - Hero TV Mounting',
      html: `
        <h2>🎉 Email Test Successful!</h2>
        <p>This email confirms that Resend is working correctly with your Hero TV Mounting application.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Domain:</strong> herotvmounting.com</p>
        <p><strong>From:</strong> noreply@herotvmounting.com</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          If you received this email, the integration is working perfectly!
        </p>
      `
    });

    if (result.error) {
      console.error('❌ Email send failed:', result.error);
      throw new Error(`Email failed: ${result.error.message}`);
    }

    console.log('✅ Email sent successfully!', result.data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Test email sent successfully!',
      emailId: result.data?.id,
      to: 'kuhuwebconnect@gmail.com',
      from: 'noreply@herotvmounting.com'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'Check function logs for more details'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});