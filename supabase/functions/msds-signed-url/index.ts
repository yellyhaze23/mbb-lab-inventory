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

function parseBearerToken(req: Request): string | null {
  const rawAuth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? null;
  if (!rawAuth) return null;
  const match = rawAuth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
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

type SignedUrlRequest = {
  msds_id?: string;
  mode?: "view" | "download";
  pin?: string;
};

function normalizePin(pin: unknown): string | null {
  if (typeof pin !== "string") return null;
  const trimmed = pin.trim();
  if (!/^\d{4,10}$/.test(trimmed)) return null;
  return trimmed;
}

async function validateStudentPin(pin: string): Promise<{ valid: boolean; reason?: string }> {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("lab_settings")
    .select("id, pin_expires_at, lab_pin_hash")
    .eq("singleton", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    console.error("msds-signed-url settings error:", settingsError);
    return { valid: false, reason: "Failed to validate PIN" };
  }

  if (!settings?.lab_pin_hash) {
    return { valid: false, reason: "Lab PIN is not configured" };
  }

  if (settings.pin_expires_at && new Date(settings.pin_expires_at) < new Date()) {
    return { valid: false, reason: "Lab PIN has expired" };
  }

  const isValid = bcrypt.compareSync(pin, settings.lab_pin_hash);
  if (!isValid) {
    return { valid: false, reason: "Invalid PIN" };
  }

  return { valid: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const body: SignedUrlRequest = await req.json().catch(() => ({}));
    const msdsId = typeof body?.msds_id === "string" ? body.msds_id.trim() : "";
    const mode = body?.mode === "download" ? "download" : "view";
    const pin = normalizePin(body?.pin);

    if (!msdsId) {
      return jsonResponse(400, { error: "msds_id is required" });
    }

    const token = parseBearerToken(req);
    let actorId: string | null = null;
    let accessType: "auth" | "student_pin" = "student_pin";

    if (token) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authData?.user) {
        return jsonResponse(401, { error: "Unauthorized" });
      }

      actorId = authData.user.id;
      accessType = "auth";

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("is_active")
        .eq("id", actorId)
        .maybeSingle();

      if (profileError) {
        console.error("msds-signed-url profile error:", profileError);
        return jsonResponse(500, { error: "Failed to validate role" });
      }

      if (!profile?.is_active) {
        return jsonResponse(403, { error: "Forbidden" });
      }
    } else {
      if (!pin) {
        return jsonResponse(401, { error: "Unauthorized" });
      }

      const pinValidation = await validateStudentPin(pin);
      if (!pinValidation.valid) {
        return jsonResponse(401, { error: pinValidation.reason || "Invalid PIN" });
      }
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from("msds_documents")
      .select("id, chemical_id, file_path, file_name")
      .eq("id", msdsId)
      .maybeSingle();

    if (docError) {
      console.error("msds-signed-url document query error:", docError);
      return jsonResponse(500, { error: "Failed to load MSDS metadata" });
    }
    if (!doc?.file_path) {
      return jsonResponse(404, { error: "MSDS not found" });
    }

    const expiresIn = 180;
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("msds")
      .createSignedUrl(doc.file_path, expiresIn, {
        download: mode === "download" ? (doc.file_name || true) : undefined,
      });

    if (signedError || !signed?.signedUrl) {
      console.error("msds-signed-url signed URL error:", signedError);
      return jsonResponse(500, { error: "Failed to generate signed URL" });
    }

    const action = mode === "download" ? "DOWNLOAD" : "VIEW";
    const { error: auditError } = await supabaseAdmin
      .from("msds_audit_logs")
      .insert({
        chemical_id: doc.chemical_id,
        msds_id: doc.id,
        action,
        actor_id: actorId,
        meta: { mode, source: "msds-signed-url", access_type: accessType },
      });

    if (auditError) {
      console.error("msds-signed-url audit log error:", auditError);
    }

    return jsonResponse(200, {
      msds_id: doc.id,
      mode,
      signed_url: signed.signedUrl,
      expires_in: expiresIn,
    });
  } catch (error) {
    console.error("msds-signed-url unhandled error:", error);
    return jsonResponse(500, { error: "Unexpected server error" });
  }
});
