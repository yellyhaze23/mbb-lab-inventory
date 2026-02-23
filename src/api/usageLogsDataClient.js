import { supabase } from '@/lib/supabaseClient';

const normalizeLog = (row) => ({
  ...row,
  created_date: row?.created_date || row?.created_at || null,
  updated_date: row?.updated_date || row?.updated_at || null,
});

const USAGE_LOG_LIST_COLUMNS = [
  'id',
  'item_id',
  'item_name',
  'item_type',
  'action',
  'quantity_used',
  'before_quantity',
  'after_quantity',
  'unit',
  'used_by_name',
  'notes',
  'source',
  'created_at',
  'updated_at',
].join(', ');

export const listUsageLogs = async (arg = 1000) => {
  const options = typeof arg === 'number' ? { limit: arg } : (arg || {});
  const { limit = 1000, search = '' } = options;

  let query = supabase
    .from('usage_logs')
    .select(USAGE_LOG_LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    query = query.or(
      [
        `item_name.ilike.%${trimmedSearch}%`,
        `used_by_name.ilike.%${trimmedSearch}%`,
        `notes.ilike.%${trimmedSearch}%`,
      ].join(',')
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []).map(normalizeLog);
};

export const listRecentUsageLogs = async (limit = 10) => {
  return listUsageLogs(limit);
};
