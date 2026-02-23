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

function parseBearerToken(req: Request): string | null {
  const rawAuth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? null;
  if (!rawAuth) return null;
  const match = rawAuth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function normalizeBaseUrl(raw: string): string {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const baseUrl = Deno.env.get("BASE_URL") || Deno.env.get("VITE_BASE_URL") || "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

if (!baseUrl) {
  throw new Error("Missing BASE_URL (or VITE_BASE_URL) environment variable.");
}

const redirectTo = `${normalizeBaseUrl(baseUrl)}/set-password`;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const token = parseBearerToken(req);
    if (!token) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const requesterId = authData.user.id;
    const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
      .from("profiles")
      .select("role, is_active")
      .eq("id", requesterId)
      .maybeSingle();

    if (requesterProfileError) {
      console.error("invite-admin requester profile error:", requesterProfileError);
      return jsonResponse(500, { error: "Failed to verify requester role" });
    }

    if (!requesterProfile?.is_active || requesterProfile.role !== "super_admin") {
      return jsonResponse(403, { error: "Forbidden" });
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(400, { error: "Valid email is required" });
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        role: "admin",
        password_set: false,
      },
    });

    if (inviteError) {
      console.error("invite-admin invite error:", inviteError);
      return jsonResponse(400, { error: inviteError.message || "Failed to send invitation" });
    }

    const invitedUser = inviteData?.user || null;
    if (invitedUser?.id) {
      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", invitedUser.id)
        .maybeSingle();

      if (existingProfileError) {
        console.error("invite-admin profile lookup error:", existingProfileError);
        return jsonResponse(500, { error: "Invitation sent but failed to verify profile." });
      }

      if (!existingProfile) {
        const { error: createProfileError } = await supabaseAdmin.from("profiles").insert({
          id: invitedUser.id,
          email,
          full_name: invitedUser.user_metadata?.full_name || email.split("@")[0] || "",
          role: "admin",
          is_active: true,
        });

        if (createProfileError) {
          console.error("invite-admin profile create error:", createProfileError);
          return jsonResponse(500, { error: "Invitation sent but failed to create profile." });
        }
      }
    }

    return jsonResponse(200, {
      success: true,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("invite-admin unhandled error:", error);
    return jsonResponse(500, { error: "Unexpected server error" });
  }
});
