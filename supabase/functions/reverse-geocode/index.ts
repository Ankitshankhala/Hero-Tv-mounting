import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReverseGeocodeRequest {
  lat: number;
  lng: number;
}

interface AddressComponent {
  postal_code?: string;
  zipcode?: string;
  zip?: string;
  postcode?: string;
}

interface ReverseGeocodeResponse {
  success: boolean;
  postal_code?: string;
  formatted_address?: string;
  provider?: string;
  error?: string;
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<ReverseGeocodeResponse> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&limit=1`,
      {
        headers: {
          'User-Agent': 'TV-Mounting-Service/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.address) {
      const postalCode = data.address.postcode || data.address.postal_code;
      if (postalCode) {
        return {
          success: true,
          postal_code: postalCode,
          formatted_address: data.display_name,
          provider: 'nominatim'
        };
      }
    }

    return { success: false, error: 'No postal code found in Nominatim response' };
  } catch (error) {
    console.error('Nominatim error:', error);
    return { success: false, error: `Nominatim failed: ${error.message}` };
  }
}

async function reverseGeocodeOpenCage(lat: number, lng: number): Promise<ReverseGeocodeResponse> {
  const apiKey = Deno.env.get('OPENCAGE_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'OpenCage API key not configured' };
  }

  try {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}&limit=1&no_annotations=1`
    );

    if (!response.ok) {
      throw new Error(`OpenCage API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const postalCode = result.components?.postcode || result.components?.postal_code;
      
      if (postalCode) {
        return {
          success: true,
          postal_code: postalCode,
          formatted_address: result.formatted,
          provider: 'opencage'
        };
      }
    }

    return { success: false, error: 'No postal code found in OpenCage response' };
  } catch (error) {
    console.error('OpenCage error:', error);
    return { success: false, error: `OpenCage failed: ${error.message}` };
  }
}

async function reverseGeocodeUSCensus(lat: number, lng: number): Promise<ReverseGeocodeResponse> {
  try {
    const response = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${lat},${lng}&benchmark=2020&format=json`
    );

    if (!response.ok) {
      throw new Error(`US Census API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result && data.result.addressMatches && data.result.addressMatches.length > 0) {
      const match = data.result.addressMatches[0];
      const postalCode = match.addressComponents?.zip;
      
      if (postalCode) {
        return {
          success: true,
          postal_code: postalCode,
          formatted_address: match.matchedAddress,
          provider: 'us_census'
        };
      }
    }

    return { success: false, error: 'No postal code found in US Census response' };
  } catch (error) {
    console.error('US Census error:', error);
    return { success: false, error: `US Census failed: ${error.message}` };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { lat, lng }: ReverseGeocodeRequest = await req.json();

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid coordinates: lat and lng must be numbers' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid coordinates: lat must be -90 to 90, lng must be -180 to 180' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Reverse geocoding coordinates: ${lat}, ${lng}`);

    // Try providers in order: Nominatim (free) -> OpenCage (has key) -> US Census (US only)
    const providers = [reverseGeocodeNominatim, reverseGeocodeOpenCage, reverseGeocodeUSCensus];
    const errors: string[] = [];

    for (const provider of providers) {
      const result = await provider(lat, lng);
      
      if (result.success && result.postal_code) {
        console.log(`Successfully reverse geocoded with ${result.provider}: ${result.postal_code}`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (result.error) {
        errors.push(result.error);
      }
    }

    // All providers failed
    console.error('All reverse geocoding providers failed:', errors);
    return new Response(JSON.stringify({
      success: false,
      error: 'All reverse geocoding providers failed',
      details: errors
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in reverse-geocode function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});