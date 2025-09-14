import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting regional ZIP code assignment...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Worker assignments with ZIP codes
    const assignments = [
      {
        workerId: '3e2e7780-6abd-40f5-a5a2-70286b7496de', // Connor
        areaName: 'North Austin',
        existingAreaId: 'dc338ae3-9392-4e67-9abb-aaa0cbc2c40f',
        zipCodes: ['78613', '78626', '78628', '78634', '78641', '78651', '78653', '78660', '78664', '78665', '78681', '78717', '78723', '78724', '78726', '78727', '78728', '78729', '78731', '78750', '78751', '78752', '78753', '78754', '78757', '78758', '78759']
      },
      {
        workerId: '84cfc1c3-f2e8-4a3d-8977-061e5639a4c9', // Henry Griffith
        areaName: 'South Austin',
        existingAreaId: '0e5fb607-cb9f-4874-a7f8-1756a29747d9',
        zipCodes: ['78652', '78701', '78702', '78703', '78704', '78705', '78712', '78719', '78721', '78722', '78723', '78724', '78730', '78731', '78732', '78733', '78735', '78736', '78737', '78738', '78739', '78741', '78742', '78744', '78745', '78746', '78747', '78748', '78749', '78750']
      },
      {
        workerId: '7a09f6e8-c068-400f-88c4-321b400a6bb0', // Ayden Alexander
        areaName: 'San Antonio',
        existingAreaId: 'e082bc18-d3d7-4393-8e20-8c4460d6ac72',
        zipCodes: ['78023', '78108', '78109', '78148', '78150', '78154', '78201', '78202', '78203', '78204', '78205', '78207', '78208', '78209', '78210', '78211', '78212', '78213', '78215', '78216', '78217', '78218', '78219', '78220', '78221', '78222', '78223', '78224', '78225', '78226', '78227', '78228', '78229', '78230', '78231', '78232', '78233', '78234', '78235', '78236', '78237', '78238', '78239', '78240', '78242', '78243', '78244', '78245', '78247', '78248', '78249', '78250', '78251', '78253', '78254', '78255', '78257', '78258', '78259', '78260', '78261', '78266', '78284']
      },
      {
        workerId: 'c6870057-c0bb-45f9-82b7-319dcf6ad84a', // Warren Kenneth Joe
        areaName: 'Fort Worth Extended',
        zipCodes: ['75050', '75051', '75052', '75054', '76001', '76002', '76006', '76010', '76011', '76012', '76013', '76014', '76015', '76016', '76017', '76018', '76021', '76022', '76028', '76034', '76036', '76039', '76040', '76051', '76052', '76053', '76054', '76060', '76063', '76092', '76102', '76103', '76104', '76105', '76106', '76107', '76108', '76109', '76110', '76111', '76112', '76114', '76115', '76116', '76117', '76118', '76119', '76120', '76123', '76126', '76131', '76132', '76133', '76134', '76135', '76137', '76140', '76148', '76155', '76164', '76177', '76179', '76180', '76182', '76244', '76248', '76262']
      },
      {
        workerId: 'bf62889f-4fba-47bd-94d5-362a475f995e', // Chad Walls
        areaName: 'Dallas Extended',
        zipCodes: ['75001', '75006', '75007', '75019', '75038', '75039', '75041', '75043', '75060', '75061', '75062', '75063', '75099', '75104', '75115', '75116', '75134', '75137', '75141', '75149', '75150', '75180', '75181', '75182', '75201', '75202', '75203', '75204', '75205', '75206', '75207', '75208', '75209', '75210', '75211', '75212', '75214', '75215', '75216', '75217', '75218', '75219', '75220', '75223', '75224', '75225', '75226', '75227', '75228', '75229', '75230', '75231', '75232', '75233', '75234', '75235', '75236', '75237', '75238', '75240', '75241', '75243', '75244', '75246', '75247', '75248', '75249', '75251', '75252', '75253', '75254', '75261', '75287', '75390']
      }
    ];

    const results = [];

    for (const assignment of assignments) {
      try {
        console.log(`Processing ${assignment.areaName} for worker ${assignment.workerId}...`);
        
        const payload = {
          workerId: assignment.workerId,
          areaName: assignment.areaName,
          zipcodesOnly: assignment.zipCodes,
          mode: 'append',
          ...(assignment.existingAreaId && { existingAreaId: assignment.existingAreaId })
        };

        console.log(`Calling admin-service-area-manager with payload:`, payload);

        const response = await supabase.functions.invoke('admin-service-area-manager', {
          body: payload
        });

        if (response.error) {
          console.error(`Error for ${assignment.areaName}:`, response.error);
          results.push({
            area: assignment.areaName,
            success: false,
            error: response.error.message,
            zipCount: assignment.zipCodes.length
          });
        } else {
          console.log(`Success for ${assignment.areaName}:`, response.data);
          results.push({
            area: assignment.areaName,
            success: true,
            zipCount: assignment.zipCodes.length,
            data: response.data
          });
        }
      } catch (error) {
        console.error(`Exception for ${assignment.areaName}:`, error);
        results.push({
          area: assignment.areaName,
          success: false,
          error: error.message,
          zipCount: assignment.zipCodes.length
        });
      }
    }

    console.log('Final results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      totalAssignments: assignments.length,
      successCount: results.filter(r => r.success).length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in assign-regional-zipcodes function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});