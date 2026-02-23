import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
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

const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const FAILURE_DELAY_MS = 700;

type AttemptState = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const attempts = new Map<string, AttemptState>();

function nowMs(): number {
  return Date.now();
}

function parseClientIp(req: Request): string {
  const xForwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const cfConnectingIp = req.headers.get("cf-connecting-ip")?.trim();
  const xRealIp = req.headers.get("x-real-ip")?.trim();
  return xForwardedFor || cfConnectingIp || xRealIp || "unknown";
}

function getKey(scope: string, req: Request): string {
  return `${scope}:${parseClientIp(req)}`;
}

function getOrCreateState(key: string): AttemptState {
  const existing = attempts.get(key);
  if (existing) return existing;
  const created: AttemptState = { count: 0, firstAttemptAt: nowMs(), lockedUntil: 0 };
  attempts.set(key, created);
  return created;
}

function resetIfExpired(state: AttemptState): void {
  const current = nowMs();
  if (current - state.firstAttemptAt > WINDOW_MS) {
    state.count = 0;
    state.firstAttemptAt = current;
    state.lockedUntil = 0;
  }
}

function checkBruteForce(scope: string, req: Request): { blocked: boolean; retryAfterMs: number } {
  const state = getOrCreateState(getKey(scope, req));
  resetIfExpired(state);
  const current = nowMs();
  if (state.lockedUntil > current) return { blocked: true, retryAfterMs: state.lockedUntil - current };
  return { blocked: false, retryAfterMs: 0 };
}

function recordBruteForceFailure(scope: string, req: Request): { attemptsLeft: number; retryAfterMs: number } {
  const key = getKey(scope, req);
  const state = getOrCreateState(key);
  resetIfExpired(state);
  state.count += 1;
  let retryAfterMs = 0;
  if (state.count >= MAX_ATTEMPTS) {
    state.lockedUntil = nowMs() + LOCK_MS;
    retryAfterMs = LOCK_MS;
  }
  attempts.set(key, state);
  return { attemptsLeft: Math.max(0, MAX_ATTEMPTS - state.count), retryAfterMs };
}

function clearBruteForceFailures(scope: string, req: Request): void {
  attempts.delete(getKey(scope, req));
}

async function addFailureDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const bruteForceState = checkBruteForce("verify-pin", req);
    if (bruteForceState.blocked) {
      return jsonResponse(429, {
        error: "Too many failed PIN attempts. Please try again later.",
        retry_after_seconds: Math.ceil(bruteForceState.retryAfterMs / 1000),
      });
    }

    const body = await req.json().catch(() => ({}));
    const pin = normalizePin(body?.pin);

    if (!pin) {
      return jsonResponse(400, { error: "Invalid PIN format" });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("lab_settings")
      .select("id, pin_expires_at, lab_pin_hash")
      .eq("singleton", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("verify-pin settings error:", settingsError);
      return jsonResponse(500, { error: "Failed to verify PIN" });
    }

    if (!settings?.lab_pin_hash) {
      return jsonResponse(400, { error: "Lab PIN is not configured" });
    }

    if (settings.pin_expires_at && new Date(settings.pin_expires_at) < new Date()) {
      return jsonResponse(403, { error: "Lab PIN has expired" });
    }

    const isValid = bcrypt.compareSync(pin, settings.lab_pin_hash);
    if (!isValid) {
      const failure = recordBruteForceFailure("verify-pin", req);
      await addFailureDelay();
      return jsonResponse(401, {
        error: "Invalid PIN",
        attempts_left: failure.attemptsLeft,
      });
    }

    clearBruteForceFailures("verify-pin", req);

    return jsonResponse(200, {
      valid: true,
      expires_at: settings.pin_expires_at ?? null,
    });
  } catch (error) {
    console.error("verify-pin unhandled error:", error);
    return jsonResponse(500, { error: "Unexpected server error" });
  }
});
