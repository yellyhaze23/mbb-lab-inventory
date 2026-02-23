import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

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

function normalizePin(pin: unknown): string | null {
  if (typeof pin !== "string") return null;
  const trimmed = pin.trim();
  if (!/^\d{4,10}$/.test(trimmed)) return null;
  return trimmed;
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const { token, hasAuthHeader, hasBearerPrefix } = parseBearerToken(req);

    if (!token) {
      console.warn("set-lab-pin unauthorized: missing/invalid auth header", {
        hasAuthHeader,
        hasBearerPrefix,
      });
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      console.warn("set-lab-pin unauthorized: token validation failed", {
        hasAuthHeader,
        hasBearerPrefix,
      });
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const userId = authData.user.id;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("set-lab-pin profile error:", profileError);
      return jsonResponse(500, { error: "Failed to verify permissions" });
    }

    if (!profile?.is_active || !["admin", "super_admin"].includes(profile.role)) {
      return jsonResponse(403, { error: "Forbidden" });
    }

    const body = await req.json().catch(() => ({}));
    const pin = normalizePin(body?.pin);
    const expiresAt =
      typeof body?.pin_expires_at === "string" && body.pin_expires_at.trim() !== ""
        ? new Date(body.pin_expires_at).toISOString()
        : null;

    if (!pin) {
      return jsonResponse(400, { error: "Invalid PIN format" });
    }

    const hash = bcrypt.hashSync(pin, 10);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("lab_settings")
      .select("id")
      .eq("singleton", true)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("set-lab-pin load existing error:", existingError);
      return jsonResponse(500, { error: "Failed to update lab PIN" });
    }

    let mutation;

    if (existing?.id) {
      mutation = await supabaseAdmin
        .from("lab_settings")
        .update({
          lab_pin_hash: hash,
          lab_pin_salt: pin,
          pin_expires_at: expiresAt,
          pin_updated_by: userId,
        })
        .eq("id", existing.id)
        .select("id, pin_expires_at, pin_updated_by, updated_at, lab_pin_salt")
        .single();
    } else {
      mutation = await supabaseAdmin
        .from("lab_settings")
        .insert({
          singleton: true,
          lab_name: "Lab",
          lab_pin_hash: hash,
          lab_pin_salt: pin,
          pin_expires_at: expiresAt,
          pin_updated_by: userId,
        })
        .select("id, pin_expires_at, pin_updated_by, updated_at, lab_pin_salt")
        .single();
    }

    if (mutation.error) {
      console.error("set-lab-pin mutation error:", mutation.error);
      return jsonResponse(500, {
        error: "Failed to update lab PIN",
        detail: mutation.error.message,
      });
    }

    return jsonResponse(200, {
      success: true,
      settings: mutation.data,
    });
  } catch (error) {
    console.error("set-lab-pin unhandled error:", error);
    return jsonResponse(500, { error: "Unexpected server error" });
  }
});
