import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "check_service_area",
  title: "Check service area",
  description: "Check whether Hero TV Mounting services a given US ZIP code.",
  inputSchema: {
    zip_code: z.string().trim().regex(/^\d{5}$/, "Must be a 5-digit US ZIP code"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ zip_code }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("service_areas")
      .select("zip_code, city, state, is_active")
      .eq("zip_code", zip_code)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const covered = !!data;
    return {
      content: [{
        type: "text",
        text: covered
          ? `Yes — ZIP ${zip_code} (${data!.city}, ${data!.state}) is in the service area.`
          : `No — ZIP ${zip_code} is not currently in the service area.`,
      }],
      structuredContent: { covered, area: data },
    };
  },
});
