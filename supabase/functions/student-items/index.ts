import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const isSchemaMismatchError = (error: unknown): boolean => {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  const details = String((error as { details?: string })?.details || "").toLowerCase();
  return (
    message.includes("could not find") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    details.includes("does not exist")
  );
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const itemId = typeof body?.item_id === "string" ? body.item_id.trim() : "";

    const selectPrimary = "id,name,category,quantity,unit,tracking_type,quantity_value,quantity_unit,unit_type,total_units,content_per_unit,content_unit,total_content_unit,content_label,total_content,room_area,storage_type,storage_number,position,location,minimum_stock,expiration_date,status,supplier,project_fund_source,msds_current_id";
    const selectLegacy = "id,name,category,quantity,unit,tracking_type,content_label,total_content,room_area,storage_type,storage_number,position,location,minimum_stock,expiration_date,status,supplier,project_fund_source,msds_current_id";

    const runItemsQuery = (columns: string) => {
      let q = supabaseAdmin
        .from("items")
        .select(columns)
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(200);
      if (itemId) q = q.eq("id", itemId).limit(1);
      return q;
    };

    let { data: rows, error } = await runItemsQuery(selectPrimary);
    if (error && isSchemaMismatchError(error)) {
      const retry = await runItemsQuery(selectLegacy);
      rows = retry.data;
      error = retry.error;
    }
    if (error) {
      console.error("student-items query error:", error);
      return jsonResponse(500, { error: "Failed to load items" });
    }

    const normalizedRows = (rows || []).map((item) => ({
      ...item,
      tracking_type: item.tracking_type || "SIMPLE_MEASURE",
      content_unit: item.content_unit || item.total_content_unit || item.content_label || null,
      total_content_unit: item.total_content_unit || item.content_unit || item.content_label || null,
      content_label: item.content_label || item.content_unit || item.total_content_unit || null,
    }));

    const packIds = normalizedRows
      .filter((item) => item.tracking_type === "PACK_WITH_CONTENT")
      .map((item) => item.id);

    const containerStats = new Map<string, { sealed_count: number; opened_count: number }>();
    if (packIds.length > 0) {
      let { data: containers, error: containersError } = await supabaseAdmin
        .from("item_containers")
        .select("item_id,status,sealed_count,remaining_content")
        .in("item_id", packIds);

      if (containersError && isSchemaMismatchError(containersError)) {
        const retry = await supabaseAdmin
          .from("item_containers")
          .select("item_id,status")
          .in("item_id", packIds);
        containers = retry.data;
        containersError = retry.error;
      }

      if (containersError) {
        console.error("student-items container query error (continuing without stats):", containersError);
        containers = [];
      }

      for (const row of containers || []) {
        const current = containerStats.get(row.item_id) || { sealed_count: 0, opened_count: 0 };
        const normalizedStatus = String(row.status || "").toLowerCase();
        if (normalizedStatus === "sealed") {
          current.sealed_count += Number(row.sealed_count || 1);
        } else if (normalizedStatus === "opened") {
          current.opened_count += 1;
        }
        containerStats.set(row.item_id, current);
      }
    }

    const items = normalizedRows.map((item) => {
      if (item.tracking_type !== "PACK_WITH_CONTENT") return item;
      const stats = containerStats.get(item.id) || { sealed_count: 0, opened_count: 0 };
      return {
        ...item,
        sealed_count: stats.sealed_count,
        opened_count: stats.opened_count,
      };
    }).filter((item) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        item.name?.toLowerCase().includes(q) ||
        item.location?.toLowerCase().includes(q) ||
        item.room_area?.toLowerCase().includes(q) ||
        item.supplier?.toLowerCase().includes(q) ||
        item.project_fund_source?.toLowerCase().includes(q)
      );
    });

    return jsonResponse(200, { items });
  } catch (error) {
    console.error("student-items unhandled error:", error);
    return jsonResponse(500, { error: "Unexpected server error" });
  }
});
