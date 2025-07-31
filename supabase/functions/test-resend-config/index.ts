import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'RESEND_API_KEY not configured'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('Testing Resend configuration...');
    const resend = new Resend(resendApiKey);

    // Try to send a test email
    const emailResult = await resend.emails.send({
      from: 'Hero TV Mounting <onboarding@resend.dev>', // Using Resend's default test domain
      to: ['kuhuwebconnect@gmail.com'], // Test email from booking data
      subject: 'Resend Configuration Test',
      html: `
        <h1>Resend Test Email</h1>
        <p>This is a test email to verify that Resend is properly configured.</p>
        <p>If you receive this email, the configuration is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `
    });

    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
      return new Response(JSON.stringify({
        success: false,
        error: emailResult.error.message,
        details: emailResult.error
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('Test email sent successfully:', emailResult.data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Test email sent successfully',
      emailId: emailResult.data?.id,
      details: emailResult.data
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});