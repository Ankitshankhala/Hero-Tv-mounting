import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOTAL_EXPECTED = 33791; // Expected ZCTA features in the GeoJSON
const START_WINDOW_SIZE = 8; // Start small to avoid 413s
const MAX_WINDOWS_PER_RUN = 600; // Cap work per invocation to avoid timeouts (increased from 400)
const MAX_BATCH_JSON_BYTES = 9 * 1024 * 1024; // ~9MB guard against payload too large
const MAX_RPC_ATTEMPTS = 3;
const BACKOFF_SERIES = [500, 1000, 2000];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function estimateJsonBytes(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

function isTransientErrorMessage(msg: string): boolean {
  return /timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|Too Large|Payload Too Large|413|429|Too Many Requests|5\d{2}|Gateway Timeout|fetch failed/i.test(msg);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let lastErrorCode: string | null = null;
  let lastErrorMessage: string | null = null;

  try {
    console.log('[ZCTA Import] Start invocation');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1) Fetch existing ZCTAs to skip duplicates
    const existingZctas = new Set<string>();
    const PAGE_SIZE = 10000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('us_zcta_polygons')
        .select('zcta5ce')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error('[ZCTA Import] Error fetching existing ZCTAs:', error);
        throw error;
      }

      if (data && data.length > 0) {
        for (const row of data) existingZctas.add(row.zcta5ce);
      }
      hasMore = !!data && data.length === PAGE_SIZE;
      page++;
    }
    console.log(`[ZCTA Import] Existing ZCTAs: ${existingZctas.size}`);

    // 2) Load GeoJSON from public storage
    const storageUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/zcta-data/zcta2020_web.geojson`;
    console.log('[ZCTA Import] Fetching GeoJSON:', storageUrl);
    const geoJsonResponse = await fetch(storageUrl);
    if (!geoJsonResponse.ok) {
      lastErrorCode = String(geoJsonResponse.status);
      lastErrorMessage = `Failed to fetch GeoJSON: ${geoJsonResponse.statusText}`;
      throw new Error(lastErrorMessage);
    }
    const geoJson = await geoJsonResponse.json();
    const totalFeatures = geoJson.features?.length || 0;
    if (!totalFeatures) {
      lastErrorMessage = 'No features found in GeoJSON';
      throw new Error(lastErrorMessage);
    }

    // 3) Build pending list (skip existing + normalize)
    const pending: any[] = [];
    let skippedExisting = 0;
    let invalid = 0;

    for (const feature of geoJson.features) {
      let zcta = feature.properties?.ZCTA5CE20
        || feature.properties?.ZCTA5CE10
        || feature.properties?.ZCTA5CE
        || feature.properties?.GEOID20
        || feature.properties?.GEOID10
        || feature.properties?.GEOID;

      if (!zcta || !feature.geometry) {
        invalid++;
        continue;
      }

      zcta = String(zcta).trim().padStart(5, '0').substring(0, 5);
      if (existingZctas.has(zcta)) {
        skippedExisting++;
        continue;
      }

      pending.push({
        zcta5ce: zcta,
        geom: JSON.stringify(feature.geometry),
        land_area: feature.properties?.ALAND20 || feature.properties?.ALAND10 || null,
        water_area: feature.properties?.AWATER20 || feature.properties?.AWATER10 || null,
      });
    }

    // 4) Helper: call RPC with retry for transport/transient errors
    const callInsertRpc = async (items: any[]): Promise<{ data: unknown; error: any }> => {
      let attempt = 0;
      while (attempt < MAX_RPC_ATTEMPTS) {
        attempt++;
        try {
          const { data, error } = await supabase.rpc('insert_zcta_batch', { batch_data: items });
          // "error" indicates server processed the request but failed (data-level issue)
          return { data, error };
        } catch (e) {
          const msg = String((e as Error)?.message || e);
          if (isTransientErrorMessage(msg) && attempt < MAX_RPC_ATTEMPTS) {
            const wait = BACKOFF_SERIES[Math.min(attempt - 1, BACKOFF_SERIES.length - 1)];
            console.warn(`[ZCTA Import] Transient RPC error (attempt ${attempt}): ${msg}. Backing off ${wait}ms`);
            await sleep(wait);
            continue;
          }
          // Non-retryable or out of attempts -> rethrow so upper layer can adjust window size
          throw e;
        }
      }
      // Should never reach here
      return { data: null, error: { message: 'Unknown RPC state' } };
    };

    // 5) Helper: insert batch with recursive split on data-level errors
    const insertBatch = async (items: any[]): Promise<{ imported: number; hardErrors: number }> => {
      if (items.length === 0) return { imported: 0, hardErrors: 0 };

      // Guard payload size
      const size = estimateJsonBytes(items);
      if (size > MAX_BATCH_JSON_BYTES && items.length > 1) {
        const mid = Math.floor(items.length / 2);
        const left = await insertBatch(items.slice(0, mid));
        const right = await insertBatch(items.slice(mid));
        return { imported: left.imported + right.imported, hardErrors: left.hardErrors + right.hardErrors };
      }

      try {
        const { data, error } = await callInsertRpc(items);
        if (error) {
          // Data-level error: split recursively
          if (items.length > 1) {
            const mid = Math.floor(items.length / 2);
            const left = await insertBatch(items.slice(0, mid));
            const right = await insertBatch(items.slice(mid));
            return { imported: left.imported + right.imported, hardErrors: left.hardErrors + right.hardErrors };
          }
          console.error('[ZCTA Import] Hard failure for single item:', error);
          return { imported: 0, hardErrors: 1 };
        }
        const inserted = typeof data === 'number' ? Number(data) : items.length;
        return { imported: inserted, hardErrors: 0 };
      } catch (e) {
        // Transport/transient error: propagate to upper level to shrink window or end early
        throw e;
      }
    };

    // 6) Insert in adaptive windows with capped work per invocation
    let imported = 0;
    let hardErrors = 0;
    let windowSize = START_WINDOW_SIZE;
    let processedWindows = 0;
    let i = 0;

    while (i < pending.length && processedWindows < MAX_WINDOWS_PER_RUN) {
      let windowItems = pending.slice(i, Math.min(i + windowSize, pending.length));

      // Preemptive size guard: shrink window until under threshold
      while (estimateJsonBytes(windowItems) > MAX_BATCH_JSON_BYTES && windowItems.length > 1) {
        windowSize = Math.max(1, Math.floor(windowSize / 2));
        windowItems = pending.slice(i, Math.min(i + windowSize, pending.length));
      }

      try {
        const result = await insertBatch(windowItems);
        imported += result.imported;
        hardErrors += result.hardErrors;
        i += windowItems.length;
        processedWindows++;

        const processed = imported + skippedExisting + invalid + hardErrors;
        console.log(`[ZCTA Import] Progress: Imported ${imported}, Skipped ${skippedExisting}, Invalid ${invalid}, HardErrors ${hardErrors} (windows ${processedWindows})`);

        // If we successfully inserted a full window, consider gently increasing the window size
        if (result.imported === windowItems.length && windowSize < 96) {
          windowSize = Math.min(96, windowSize + 1);
        }
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        lastErrorMessage = msg;
        lastErrorCode = isTransientErrorMessage(msg) ? 'transient' : 'error';
        console.warn(`[ZCTA Import] Insert window failed: ${msg}`);

        if (windowSize > 1) {
          windowSize = Math.max(1, Math.floor(windowSize / 2));
          console.log(`[ZCTA Import] Reducing window size to ${windowSize} and retrying…`);
          continue; // retry with smaller window at same index
        }
        // If already at size 1 and still failing (transport-level), end this run and let UI resume
        break;
      }
    }

    // 7) Verify DB count and compute remaining
    const { count } = await supabase
      .from('us_zcta_polygons')
      .select('*', { count: 'exact', head: true });

    const pendingCount = pending.length - i;
    const remainingEstimated = Math.max(0, (TOTAL_EXPECTED || 0) - (count || 0));
    const moreRemaining = pendingCount > 0 || remainingEstimated > 0;

    console.log(`[ZCTA Import] Invocation end. TotalFeatures: ${totalFeatures}, Imported: ${imported}, Skipped: ${skippedExisting}, Invalid: ${invalid}, HardErrors: ${hardErrors}, PendingCount: ${pendingCount}, DB Count: ${count}, RemainingEst: ${remainingEstimated}, MoreRemaining: ${moreRemaining}`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skippedExisting,
        invalid,
        hardErrors,
        databaseCount: count,
        totalFeatures,
        pendingCount,
        remainingEstimated,
        moreRemaining,
        lastErrorCode,
        lastErrorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[ZCTA Import] Fatal error:', msg);
    if (!lastErrorMessage) lastErrorMessage = msg;
    if (!lastErrorCode) lastErrorCode = isTransientErrorMessage(msg) ? 'transient' : 'error';

    return new Response(
      JSON.stringify({ success: false, lastErrorCode, lastErrorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
