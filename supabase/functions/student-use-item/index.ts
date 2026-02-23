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

type StudentUsePayload = {
  pin?: string;
  item_id?: string;
  quantity?: number;
  deduct_mode?: "CONTENT" | "UNITS";
  student_name?: string;
  student_id?: string | null;
  experiment?: string | null;
  notes?: string | null;
};

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
    const bruteForceState = checkBruteForce("student-use-item", req);
    if (bruteForceState.blocked) {
      return jsonResponse(429, {
        error: "Too many failed PIN attempts. Please try again later.",
        retry_after_seconds: Math.ceil(bruteForceState.retryAfterMs / 1000),
      });
    }

    const body = (await req.json().catch(() => ({}))) as StudentUsePayload;
    const pin = normalizePin(body.pin);
    const itemId = body.item_id?.trim();
    const quantity = Number(body.quantity);
    const deductMode = (body.deduct_mode || "CONTENT").toUpperCase();
    const studentName = body.student_name?.trim();

    if (!pin) return jsonResponse(400, { error: "Invalid PIN format" });
    if (!itemId) return jsonResponse(400, { error: "item_id is required" });
    if (!studentName) return jsonResponse(400, { error: "student_name is required" });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return jsonResponse(400, { error: "quantity must be greater than 0" });
    }
    if (deductMode !== "CONTENT" && deductMode !== "UNITS") {
      return jsonResponse(400, { error: "deduct_mode must be CONTENT or UNITS" });
    }
    if (deductMode === "UNITS" && !Number.isInteger(quantity)) {
      return jsonResponse(400, { error: "quantity must be a whole number for UNITS mode" });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("lab_settings")
      .select("id, pin_expires_at, lab_pin_hash")
      .eq("singleton", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("student-use-item settings error:", settingsError);
      return jsonResponse(500, { error: "Failed to validate PIN" });
    }

    if (!settings?.lab_pin_hash) {
      return jsonResponse(400, { error: "Lab PIN is not configured" });
    }

    if (settings.pin_expires_at && new Date(settings.pin_expires_at) < new Date()) {
      return jsonResponse(403, { error: "Lab PIN has expired" });
    }

    const isValidPin = bcrypt.compareSync(pin, settings.lab_pin_hash);
    if (!isValidPin) {
      const failure = recordBruteForceFailure("student-use-item", req);
      await addFailureDelay();
      return jsonResponse(401, {
        error: "Invalid PIN",
        attempts_left: failure.attemptsLeft,
      });
    }

    clearBruteForceFailures("student-use-item", req);

    const idempotencyKey = req.headers.get("x-idempotency-key")?.trim() || crypto.randomUUID();

    const { data, error } = await supabaseAdmin.rpc("use_deduct_item", {
      p_item_id: itemId,
      p_mode: deductMode,
      p_amount: quantity,
      p_used_by_name: studentName,
      p_used_by_id: null,
      p_notes: body.notes?.trim() ?? "",
      p_student_id: body.student_id?.trim() || null,
      p_experiment: body.experiment?.trim() || null,
      p_source: "student_mode",
    });

    if (error) {
      console.error("student-use-item rpc error:", error);
      return jsonResponse(400, {
        error: error.message || "Failed to record student usage",
      });
    }

    return jsonResponse(200, {
      success: true,
      idempotency_key: idempotencyKey,
      result: data,
    });
  } catch (error) {
    console.error("student-use-item unhandled error:", error);
    return jsonResponse(500, { error: "Unexpected server error" });
  }
});
