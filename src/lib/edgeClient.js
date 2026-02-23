import { supabase } from '@/lib/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function resolveAccessToken(requireAuth) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let token = session?.access_token || null;

  if (requireAuth && token) {
    const { error: userError } = await supabase.auth.getUser(token);

    if (userError) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      token = !refreshError ? refreshed?.session?.access_token || null : null;

      if (token) {
        const { error: refreshedUserError } = await supabase.auth.getUser(token);
        if (refreshedUserError) {
          token = null;
        }
      }
    }
  }

  return token;
}

export async function invokeEdgeFunction(functionName, payload = {}, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  const requireAuth = Boolean(options.requireAuth);
  const accessToken = await resolveAccessToken(requireAuth);

  if (requireAuth && !accessToken) {
    throw new Error('Please log in again');
  }

  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    ...(options.headers || {}),
  };

  if (requireAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Function ${functionName} failed (${response.status})`);
  }

  return data;
}
