import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseBearerToken(req: Request): {
  token: string | null;
  hasAuthHeader: boolean;
  hasBearerPrefix: boolean;
} {
  const rawAuth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? null;
  const hasAuthHeader = Boolean(rawAuth);
  const hasBearerPrefix = Boolean(rawAuth && /^Bearer\s+/i.test(rawAuth));

  if (!rawAuth) {
    return { token: null, hasAuthHeader, hasBearerPrefix };
  }

  const match = rawAuth.match(/^Bearer\s+(.+)$/i);
  return {
    token: match?.[1]?.trim() || null,
    hasAuthHeader,
    hasBearerPrefix,  
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const { token, hasAuthHeader, hasBearerPrefix } = parseBearerToken(req);

    if (!token) {
      console.warn("get-lab-settings unauthorized: missing/invalid auth header", {
        hasAuthHeader,
        hasBearerPrefix,
      });
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      console.warn("get-lab-settings unauthorized: token validation failed", {
        hasAuthHeader,
        hasBearerPrefix,
      });
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role,is_active")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) return jsonResponse(500, { error: "Failed to verify permissions" });

    if (!profile?.is_active || !["admin", "super_admin"].includes(profile.role)) {
      return jsonResponse(403, { error: "Forbidden" });
    }

    const { data, error } = await supabaseAdmin
      .from("lab_settings")
      .select("id, pin_expires_at, pin_updated_by, updated_at, lab_pin_hash, lab_pin_salt")
      .eq("singleton", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonResponse(500, { error: "Failed to load lab settings" });

    const settings = data ? {
      id: data.id,
      pin_expires_at: data.pin_expires_at,
      pin_updated_by: data.pin_updated_by,
      updated_at: data.updated_at,
      has_pin: Boolean(data.lab_pin_hash),
      current_pin: data.lab_pin_salt || "",
    } : null;

    return jsonResponse(200, { settings });
  } catch (e) {
    console.error("get-lab-settings unhandled error:", e);
    return jsonResponse(500, { error: "Unexpected server error" });
  }
});
