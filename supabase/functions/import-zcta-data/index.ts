// Real ZCTA polygon importer.
//
// Strategy: iterate US states. For each state we fetch the per-state ZCTA
// GeoJSON from OpenDataDE's well-known mirror, then insert features in batches.
// Progress is tracked in `public.zcta_import_state` so the function can be
// invoked repeatedly until completion (the existing ZctaDataManager UI loops
// until `pendingCount` is 0 for two passes).
//
// Each invocation processes at most ~1500 features to stay within the edge
// function execution budget. Inserts use the PostGIS function ST_GeomFromGeoJSON
// via a single SQL statement per batch.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOTAL_FEATURES = 33791;
const MAX_FEATURES_PER_INVOCATION = 1500;
const INSERT_BATCH = 100;

// 50 states + DC. Order roughly by population so the most useful coverage lands
// first, but order itself doesn't matter for correctness.
const STATE_ABBRS = [
  'TX','CA','FL','NY','PA','IL','OH','GA','NC','MI','NJ','VA','WA','AZ','MA',
  'TN','IN','MO','MD','WI','CO','MN','SC','AL','LA','KY','OR','OK','CT','UT',
  'IA','NV','AR','MS','KS','NM','NE','ID','WV','HI','NH','ME','MT','RI','DE',
  'SD','ND','AK','VT','WY','DC',
];

function geoJsonUrl(state: string): string {
  // OpenDataDE mirror — per-state ZCTA polygon GeoJSON, one feature per ZCTA.
  return `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${state.toLowerCase()}_${stateNameLower(state)}_zip_codes_geo.min.json`;
}

function stateNameLower(abbr: string): string {
  const m: Record<string, string> = {
    AL:'alabama',AK:'alaska',AZ:'arizona',AR:'arkansas',CA:'california',CO:'colorado',CT:'connecticut',DE:'delaware',
    FL:'florida',GA:'georgia',HI:'hawaii',ID:'idaho',IL:'illinois',IN:'indiana',IA:'iowa',KS:'kansas',KY:'kentucky',
    LA:'louisiana',ME:'maine',MD:'maryland',MA:'massachusetts',MI:'michigan',MN:'minnesota',MS:'mississippi',MO:'missouri',
    MT:'montana',NE:'nebraska',NV:'nevada',NH:'new_hampshire',NJ:'new_jersey',NM:'new_mexico',NY:'new_york',
    NC:'north_carolina',ND:'north_dakota',OH:'ohio',OK:'oklahoma',OR:'oregon',PA:'pennsylvania',RI:'rhode_island',
    SC:'south_carolina',SD:'south_dakota',TN:'tennessee',TX:'texas',UT:'utah',VT:'vermont',VA:'virginia',
    WA:'washington',WV:'west_virginia',WI:'wisconsin',WY:'wyoming',DC:'district_of_columbia',
  };
  return m[abbr] ?? abbr.toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  let imported = 0;
  let skippedExisting = 0;
  let invalid = 0;
  let hardErrors = 0;
  let lastErrorMessage = '';

  try {
    // Find the next state to process.
    const { data: progressRows, error: progErr } = await supabase
      .from('zcta_import_state')
      .select('state_abbr, feature_offset, total_features, completed');
    if (progErr) throw new Error(`Read progress failed: ${progErr.message}`);

    const progressByState = new Map<string, { offset: number; total: number | null; completed: boolean }>();
    for (const r of progressRows ?? []) {
      progressByState.set(r.state_abbr, { offset: r.feature_offset, total: r.total_features, completed: r.completed });
    }

    let processedThisRun = 0;
    let stateProcessed: string | null = null;

    for (const state of STATE_ABBRS) {
      if (processedThisRun >= MAX_FEATURES_PER_INVOCATION) break;

      const p = progressByState.get(state) ?? { offset: 0, total: null, completed: false };
      if (p.completed) continue;

      stateProcessed = state;
      const url = geoJsonUrl(state);
      console.log('[ZCTA-IMPORT] Fetching', { state, url, offset: p.offset });

      let json: any;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErrorMessage = `Fetch ${state}: ${msg}`;
        await supabase.from('zcta_import_state').upsert({
          state_abbr: state, feature_offset: p.offset, last_error: msg, updated_at: new Date().toISOString(),
        });
        // Mark as completed so we don't retry forever for missing states.
        await supabase.from('zcta_import_state').update({ completed: true }).eq('state_abbr', state);
        continue;
      }

      const features = Array.isArray(json?.features) ? json.features : [];
      const total = features.length;
      await supabase.from('zcta_import_state').upsert({
        state_abbr: state, feature_offset: p.offset, total_features: total, completed: false,
        updated_at: new Date().toISOString(),
      });

      // Slice features for this run.
      const remainingBudget = MAX_FEATURES_PER_INVOCATION - processedThisRun;
      const end = Math.min(total, p.offset + remainingBudget);
      const slice = features.slice(p.offset, end);

      // Insert in batches.
      for (let i = 0; i < slice.length; i += INSERT_BATCH) {
        const batch = slice.slice(i, i + INSERT_BATCH);
        const valid: { zcta5ce: string; geom: any }[] = [];
        for (const f of batch) {
          const z = String(f?.properties?.ZCTA5CE10 ?? f?.properties?.ZCTA5CE20 ?? f?.properties?.ZCTA5CE ?? '').padStart(5, '0').slice(0, 5);
          const g = f?.geometry;
          if (!z || !g) { invalid++; continue; }
          valid.push({ zcta5ce: z, geom: g });
        }
        if (valid.length === 0) continue;

        // Use the postgrest `rpc` is overkill; instead use a single SQL via
        // the RPC `insert_zcta_polygons_batch` if it exists, else fall back
        // to one INSERT per row using ST_GeomFromGeoJSON via supabase-js .rpc.
        // Simplest: use insert with `geom` as a GeoJSON string — PostGIS will
        // coerce it because the column is a geometry type and we cast in SQL.
        // To do that here we use a raw RPC. Provide a tiny helper function
        // call instead: ST_GeomFromGeoJSON wrapped server-side via .rpc.

        // We'll call the helper in a single insert by sending text payload and
        // relying on a server-side trigger… but we don't have one. So fall
        // back to per-row insert using rpc to a helper we expect to exist.
        // To avoid requiring a new SQL helper, do per-row inserts via
        // `from('us_zcta_polygons').insert([...])` but we need to send geom
        // as WKT. Convert GeoJSON → WKT here.

        const rows = valid.map(v => ({
          zcta5ce: v.zcta5ce,
          geom: geoJsonToWkt(v.geom),
          land_area: null,
          water_area: null,
        })).filter(r => !!r.geom);

        if (rows.length === 0) continue;

        const { error: insErr } = await supabase
          .from('us_zcta_polygons')
          .upsert(rows, { onConflict: 'zcta5ce', ignoreDuplicates: true });

        if (insErr) {
          // Some duplicates / conflict variations — count and continue.
          if (/duplicate|unique|23505/i.test(insErr.message)) {
            skippedExisting += rows.length;
          } else {
            hardErrors += rows.length;
            lastErrorMessage = insErr.message;
            console.error('[ZCTA-IMPORT] Insert error:', insErr.message);
          }
        } else {
          imported += rows.length;
        }
      }

      processedThisRun += slice.length;
      const newOffset = p.offset + slice.length;
      const completed = newOffset >= total;

      await supabase.from('zcta_import_state').upsert({
        state_abbr: state,
        feature_offset: newOffset,
        total_features: total,
        completed,
        last_error: null,
        updated_at: new Date().toISOString(),
      });

      if (!completed) break; // Stay on this state across runs.
    }

    // Compute pending counts for client.
    const { data: refreshed } = await supabase
      .from('zcta_import_state')
      .select('state_abbr, feature_offset, total_features, completed');
    let pendingCount = 0;
    for (const r of refreshed ?? []) {
      if (!r.completed && r.total_features != null) {
        pendingCount += Math.max(0, (r.total_features as number) - (r.feature_offset as number));
      }
    }
    // States not yet started/known: assume non-zero so the UI keeps polling.
    const seen = new Set((refreshed ?? []).map(r => r.state_abbr));
    const unseen = STATE_ABBRS.filter(s => !seen.has(s)).length;
    if (unseen > 0) pendingCount += unseen * 50; // rough estimate

    const { count: currentTotal } = await supabase
      .from('us_zcta_polygons')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      imported,
      skippedExisting,
      invalid,
      hardErrors,
      pendingCount,
      remainingEstimated: Math.max(0, TOTAL_FEATURES - (currentTotal || 0)),
      moreRemaining: pendingCount > 0,
      totalFeatures: TOTAL_FEATURES,
      currentTotal: currentTotal || 0,
      stateProcessed,
      lastErrorMessage,
      tookMs: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    console.error('[ZCTA-IMPORT] Fatal:', e);
    return new Response(JSON.stringify({
      success: false,
      imported,
      skippedExisting,
      invalid,
      hardErrors,
      lastErrorMessage: e instanceof Error ? e.message : String(e),
      moreRemaining: true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

/** Minimal GeoJSON Polygon / MultiPolygon → WKT converter. */
function geoJsonToWkt(g: any): string | null {
  if (!g || !g.type) return null;
  if (g.type === 'Polygon') return `SRID=4326;POLYGON(${ringsToWkt(g.coordinates)})`;
  if (g.type === 'MultiPolygon') {
    const polys = g.coordinates.map((rings: any) => `(${ringsToWkt(rings)})`).join(',');
    return `SRID=4326;MULTIPOLYGON(${polys})`;
  }
  return null;
}

function ringsToWkt(rings: number[][][]): string {
  return rings.map(ring => `(${ring.map(c => `${c[0]} ${c[1]}`).join(',')})`).join(',');
}
