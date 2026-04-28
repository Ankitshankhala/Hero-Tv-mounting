// Seed the public.us_zip_codes table from a public US ZIP centroid dataset.
// Source: https://github.com/scpike/us-state-county-zip / OpenDataDE — using a
// well-maintained CSV mirror with: zip, city, state_id, state_name, lat, lng.
//
// Idempotent: uses upsert on `zipcode` primary-ish column. Safe to re-run.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SimpleMaps free US ZIP CSV (~42k rows). Stable URL.
const ZIP_CSV_URL = 'https://raw.githubusercontent.com/midwire/free_zipcode_data/master/all_us_zipcodes.csv';

interface ZipRow {
  zipcode: string;
  city: string;
  state: string;
  state_abbr: string;
  latitude: number;
  longitude: number;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const onlyState: string | undefined = body?.state ? String(body.state).toUpperCase() : undefined;

    console.log('[SEED-ZIPS] Downloading CSV…', { onlyState });
    const res = await fetch(ZIP_CSV_URL);
    if (!res.ok) throw new Error(`Failed to fetch ZIP CSV: ${res.status}`);
    const text = await res.text();

    const lines = text.split(/\r?\n/);
    const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    // Expected: zip_code,zip_code_type,city,state,location_type,latitude,longitude,location,decommissioned, ...
    const idx = (k: string) => header.indexOf(k);
    const iZip = idx('zip_code') !== -1 ? idx('zip_code') : idx('zip');
    const iCity = idx('city');
    const iState = idx('state');
    const iLat = idx('latitude') !== -1 ? idx('latitude') : idx('lat');
    const iLng = idx('longitude') !== -1 ? idx('longitude') : idx('lng');

    if ([iZip, iCity, iState, iLat, iLng].some(v => v === -1)) {
      throw new Error(`Unexpected CSV header: ${header.join(',')}`);
    }

    const stateNameByAbbr: Record<string, string> = {
      AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',
      FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
      LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
      MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
      NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',
      SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
      WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',
    };

    const rows: ZipRow[] = [];
    const seen = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cols = parseCsvLine(line);
      const zip = (cols[iZip] || '').trim();
      const lat = parseFloat(cols[iLat]);
      const lng = parseFloat(cols[iLng]);
      const stateAbbr = (cols[iState] || '').trim().toUpperCase();
      if (!zip || isNaN(lat) || isNaN(lng) || !stateAbbr) continue;
      if (onlyState && stateAbbr !== onlyState) continue;
      const padded = zip.padStart(5, '0').slice(0, 5);
      if (seen.has(padded)) continue;
      seen.add(padded);
      rows.push({
        zipcode: padded,
        city: (cols[iCity] || '').trim() || 'Unknown',
        state: stateNameByAbbr[stateAbbr] || stateAbbr,
        state_abbr: stateAbbr,
        latitude: lat,
        longitude: lng,
      });
    }

    console.log('[SEED-ZIPS] Parsed rows:', rows.length);

    let inserted = 0;
    let errors = 0;
    const BATCH = 1000;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from('us_zip_codes')
        .upsert(batch, { onConflict: 'zipcode', ignoreDuplicates: false });
      if (error) {
        console.error('[SEED-ZIPS] Batch error', { i, err: error.message });
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    const { count: finalCount } = await supabase
      .from('us_zip_codes')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      parsed: rows.length,
      upserted: inserted,
      errors,
      tableTotal: finalCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    console.error('[SEED-ZIPS] Error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : String(e),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
