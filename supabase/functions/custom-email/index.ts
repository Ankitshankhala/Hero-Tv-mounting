
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// CORS headers for allowing requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  email: string
  subject: string
  content: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  try {
    const emailData = await req.json() as EmailRequest

    // This is where you would normally send the email using a service like SendGrid, Mailgun, etc.
    // For now, we'll just log it and return a success response
    console.log('Sending email to:', emailData.email)
    console.log('Subject:', emailData.subject)
    console.log('Content:', emailData.content)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email would be sent in production',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in custom email function:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal Server Error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
