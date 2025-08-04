import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
  temporaryPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Worker welcome email triggered');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: WelcomeEmailRequest = await req.json();
    console.log('Welcome email request for:', requestData.email);

    // Validate required fields
    if (!requestData.email || !requestData.name || !requestData.temporaryPassword) {
      throw new Error('Missing required fields: email, name, and temporaryPassword are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not found');
    }

    const resend = new Resend(resendApiKey);

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .credentials { background: #ffffff; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
            .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Hero TV Mounting!</h1>
            </div>
            <div class="content">
              <h2>Hello ${requestData.name},</h2>
              
              <p>Congratulations! Your application to join the Hero TV Mounting team has been approved. We're excited to have you on board!</p>
              
              <div class="credentials">
                <h3>🔐 Your Login Credentials</h3>
                <p><strong>Email:</strong> ${requestData.email}</p>
                <p><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${requestData.temporaryPassword}</code></p>
              </div>
              
              <div class="warning">
                <h4>⚠️ Important Security Notice</h4>
                <p><strong>Please change your password immediately after your first login</strong> for security purposes. This temporary password should only be used for your initial access.</p>
              </div>
              
              <a href="https://ggvplltpwsnvtcbpazbe.supabase.co/worker-dashboard" class="button">Access Worker Dashboard</a>
              
              <h3>🚀 Getting Started</h3>
              <ul>
                <li>Log in to your worker dashboard using the credentials above</li>
                <li>Complete your profile and set your availability</li>
                <li>Review upcoming job assignments</li>
                <li>Update your contact information if needed</li>
              </ul>
              
              <h3>📞 Need Help?</h3>
              <p>If you have any questions or need assistance getting started, please don't hesitate to contact our support team:</p>
              <ul>
                <li>Email: support@herotvmounting.com</li>
                <li>Phone: (555) 123-4567</li>
              </ul>
              
              <p>Welcome to the team!</p>
              <p><strong>Hero TV Mounting Management Team</strong></p>
            </div>
            <div class="footer">
              <p>© 2025 Hero TV Mounting. All rights reserved.</p>
              <p>This email contains sensitive login information. Please keep it secure.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend
    console.log('Sending welcome email to:', requestData.email);
    const emailResult = await resend.emails.send({
      from: 'Hero TV Mounting <noreply@herotvmounting.com>',
      to: [requestData.email],
      subject: 'Welcome to Hero TV Mounting - Your Account is Ready!',
      html: emailHtml,
    });

    console.log('Email sent successfully:', emailResult);

    // Log email in database
    const emailLogData = {
      recipient_email: requestData.email,
      subject: 'Welcome to Hero TV Mounting - Your Account is Ready!',
      status: 'sent',
      email_type: 'worker_welcome',
      metadata: {
        resend_id: emailResult.data?.id,
        worker_name: requestData.name,
        has_temporary_password: true
      }
    };

    const { error: logError } = await supabase
      .from('email_logs')
      .insert(emailLogData);

    if (logError) {
      console.error('Failed to log email:', logError);
      // Don't throw here - email was sent successfully
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Welcome email sent successfully',
      email_id: emailResult.data?.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Welcome email error:', error);

    // Try to log the failure if we have enough info
    try {
      const requestData = await req.clone().json().catch(() => null);
      if (requestData?.email) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && serviceKey) {
          const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });

          await supabase.from('email_logs').insert({
            recipient_email: requestData.email,
            subject: 'Welcome to Hero TV Mounting - Your Account is Ready!',
            status: 'failed',
            email_type: 'worker_welcome',
            error_message: error.message
          });
        }
      }
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);