import { supabase } from '@/lib/supabaseClient';

const normalizeProfile = (row) => ({
  ...row,
  created_by: row?.created_by || row?.email || null,
  created_date: row?.created_date || row?.created_at || null,
  updated_date: row?.updated_date || row?.updated_at || null,
});

export const listProfiles = async (limit = 100) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(normalizeProfile);
};

export const getProfileByUserId = async (userId, fallbackEmail = null, fallbackMeta = {}) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      id: userId,
      email: fallbackEmail,
      created_by: fallbackEmail,
      full_name: fallbackMeta?.full_name || fallbackEmail?.split('@')[0] || 'User',
      role: 'admin',
      is_active: true,
      avatar_url: null,
    };
  }

  return normalizeProfile(data);
};

export const updateProfileById = async (profileId, payload) => {
  const { error } = await supabase.from('profiles').update(payload).eq('id', profileId);
  if (error) throw error;
};
