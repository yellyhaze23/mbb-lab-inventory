const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOCK_MS = 10 * 60 * 1000; // 10 minutes
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

  const created: AttemptState = {
    count: 0,
    firstAttemptAt: nowMs(),
    lockedUntil: 0,
  };
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

export function checkBruteForce(scope: string, req: Request): { blocked: boolean; retryAfterMs: number } {
  const key = getKey(scope, req);
  const state = getOrCreateState(key);
  resetIfExpired(state);

  const current = nowMs();
  if (state.lockedUntil > current) {
    return { blocked: true, retryAfterMs: state.lockedUntil - current };
  }
  return { blocked: false, retryAfterMs: 0 };
}

export function recordBruteForceFailure(scope: string, req: Request): { attemptsLeft: number; retryAfterMs: number } {
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

export function clearBruteForceFailures(scope: string, req: Request): void {
  attempts.delete(getKey(scope, req));
}

export async function addFailureDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
}
