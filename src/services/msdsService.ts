import { supabase } from '@/lib/supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type MsdsAccessMode = 'view' | 'download';

type SignedUrlResponse = {
  signed_url?: string;
  error?: string;
  message?: string;
};

export async function getSignedMsdsUrl(
  msdsId: string,
  mode: MsdsAccessMode,
  options?: { pin?: string | null }
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment configuration.');
  }

  if (!msdsId?.trim()) {
    throw new Error('MSDS record is missing.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/msds-signed-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      msds_id: msdsId,
      mode,
      pin: options?.pin || undefined,
    }),
  });

  const data = (await response.json().catch(() => null)) as SignedUrlResponse | null;
  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Unable to access MSDS right now.');
  }

  if (!data?.signed_url) {
    throw new Error('Unable to generate secure MSDS link.');
  }

  return data.signed_url;
}
