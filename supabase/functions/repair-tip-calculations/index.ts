import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    console.log('🔧 Phase 2: Historical Data Repair Started');
    console.log('Mode:', dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify data)');

    const results = {
      step1_backfill: { affected: 0, details: [] as any[] },
      step2_transactions: { affected: 0, details: [] as any[] },
      step3_bookings: { affected: 0, details: [] as any[] },
    };

    // STEP 1: Backfill missing booking_services
    console.log('\n📊 STEP 1: Finding bookings without services...');
    
    const { data: bookingsNeedingServices, error: findError } = await supabaseClient
      .from('bookings')
      .select(`
        id,
        service_id,
        payment_intent_id,
        created_at,
        services:services!bookings_service_id_fkey(id, name, base_price),
        booking_services(id)
      `)
      .not('payment_intent_id', 'is', null)
      .not('status', 'in', '(cancelled,pending)')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (findError) {
      console.error('Error finding bookings:', findError);
      throw new Error(`Failed to find bookings: ${findError.message}`);
    }

    // Filter to only bookings with NO booking_services
    const bookingsToBackfill = (bookingsNeedingServices || []).filter((b: any) => 
      !b.booking_services || b.booking_services.length === 0
    );

    console.log(`Found ${bookingsToBackfill.length} bookings needing service backfill`);

    if (!dryRun && bookingsToBackfill.length > 0) {
      const serviceInserts = bookingsToBackfill.map((b: any) => ({
        id: crypto.randomUUID(),
        booking_id: b.id,
        service_id: b.service_id,
        service_name: b.services?.name || 'Unknown Service',
        base_price: b.services?.base_price || 0,
        quantity: 1,
        configuration: {},
      }));

      const { error: insertError } = await supabaseClient
        .from('booking_services')
        .insert(serviceInserts);

      if (insertError) {
        console.error('Error inserting services:', insertError);
        throw new Error(`Failed to insert booking services: ${insertError.message}`);
      }

      // Log backfill operations
      const auditLogs = bookingsToBackfill.map((b: any) => ({
        booking_id: b.id,
        operation: 'backfill_services',
        status: 'success',
        details: {
          reason: 'Phase 2: Backfilled missing booking_services',
          service_id: b.service_id,
          service_name: b.services?.name,
          base_price: b.services?.base_price,
        },
      }));

      await supabaseClient.from('booking_audit_log').insert(auditLogs);
      
      results.step1_backfill.affected = bookingsToBackfill.length;
      console.log(`✅ Backfilled ${bookingsToBackfill.length} booking_services records`);
    } else {
      results.step1_backfill.details = bookingsToBackfill.slice(0, 10);
      console.log('DRY RUN: Would backfill', bookingsToBackfill.length, 'records');
    }

    // STEP 2: Recalculate transaction amounts
    console.log('\n💰 STEP 2: Recalculating transaction amounts...');
    
    // Get all transactions with their booking services
    const { data: transactions, error: txError } = await supabaseClient.rpc('get_transactions_for_repair', {
      days_back: 90
    }).catch(async () => {
      // Fallback if RPC doesn't exist - query directly
      const { data, error } = await supabaseClient
        .from('transactions')
        .select(`
          id,
          booking_id,
          amount,
          base_amount,
          tip_amount,
          bookings!inner(
            id,
            payment_intent_id,
            created_at,
            booking_services(base_price, quantity)
          )
        `)
        .gte('bookings.created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .not('bookings.payment_intent_id', 'is', null);
      
      return { data, error };
    });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    const transactionsNeedingFix = (transactions || []).map((t: any) => {
      const services = t.bookings?.booking_services || [];
      const servicesTotal = services.reduce((sum: number, s: any) => 
        sum + (parseFloat(s.base_price) * s.quantity), 0
      );
      const correctTipAmount = t.amount - servicesTotal;

      return {
        id: t.id,
        booking_id: t.booking_id,
        amount: t.amount,
        oldBaseAmount: t.base_amount,
        oldTipAmount: t.tip_amount,
        newBaseAmount: servicesTotal,
        newTipAmount: correctTipAmount,
        needsUpdate: t.base_amount !== servicesTotal || t.tip_amount !== correctTipAmount,
      };
    }).filter(t => t.needsUpdate);

    console.log(`Found ${transactionsNeedingFix.length} transactions needing correction`);

    if (!dryRun && transactionsNeedingFix.length > 0) {
      for (const tx of transactionsNeedingFix) {
        await supabaseClient
          .from('transactions')
          .update({
            base_amount: tx.newBaseAmount,
            tip_amount: tx.newTipAmount,
          })
          .eq('id', tx.id);

        // Log correction
        await supabaseClient.from('booking_audit_log').insert({
          booking_id: tx.booking_id,
          operation: 'recalculate_transaction_amounts',
          status: 'success',
          details: {
            reason: 'Phase 2: Corrected tip calculation',
            transaction_id: tx.id,
            old_base_amount: tx.oldBaseAmount,
            old_tip_amount: tx.oldTipAmount,
            new_base_amount: tx.newBaseAmount,
            new_tip_amount: tx.newTipAmount,
            total_amount: tx.amount,
          },
        });
      }

      results.step2_transactions.affected = transactionsNeedingFix.length;
      console.log(`✅ Corrected ${transactionsNeedingFix.length} transaction records`);
    } else {
      results.step2_transactions.details = transactionsNeedingFix.slice(0, 10);
      console.log('DRY RUN: Would correct', transactionsNeedingFix.length, 'transactions');
    }

    // STEP 3: Sync bookings.tip_amount with corrected transactions
    console.log('\n🔄 STEP 3: Syncing booking tip amounts...');

    const { data: bookingsToSync, error: syncError } = await supabaseClient
      .from('bookings')
      .select(`
        id,
        tip_amount,
        payment_intent_id,
        transactions!inner(tip_amount)
      `)
      .not('payment_intent_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if (syncError) {
      console.error('Error fetching bookings for sync:', syncError);
      throw new Error(`Failed to fetch bookings: ${syncError.message}`);
    }

    const bookingsNeedingSync = (bookingsToSync || []).filter((b: any) => {
      const txTip = b.transactions?.[0]?.tip_amount || 0;
      return b.tip_amount !== txTip;
    });

    console.log(`Found ${bookingsNeedingSync.length} bookings needing tip sync`);

    if (!dryRun && bookingsNeedingSync.length > 0) {
      for (const booking of bookingsNeedingSync) {
        const newTipAmount = booking.transactions[0].tip_amount;
        
        await supabaseClient
          .from('bookings')
          .update({ tip_amount: newTipAmount })
          .eq('id', booking.id);

        // Log sync
        await supabaseClient.from('booking_audit_log').insert({
          booking_id: booking.id,
          operation: 'sync_booking_tip_amount',
          status: 'success',
          payment_intent_id: booking.payment_intent_id,
          details: {
            reason: 'Phase 2: Synced booking tip with transaction',
            old_tip_amount: booking.tip_amount,
            new_tip_amount: newTipAmount,
          },
        });
      }

      results.step3_bookings.affected = bookingsNeedingSync.length;
      console.log(`✅ Synced ${bookingsNeedingSync.length} booking tip amounts`);
    } else {
      results.step3_bookings.details = bookingsNeedingSync.slice(0, 10);
      console.log('DRY RUN: Would sync', bookingsNeedingSync.length, 'booking tips');
    }

    console.log('\n✅ Phase 2: Historical Data Repair Complete');
    console.log('Summary:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        results,
        message: dryRun 
          ? 'Dry run complete. Set dryRun=false to apply changes.'
          : 'Data repair complete. All corrections have been applied.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in repair-tip-calculations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to repair data',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
