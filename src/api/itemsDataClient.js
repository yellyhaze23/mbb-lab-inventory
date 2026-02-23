import { supabase } from '@/lib/supabaseClient';

const DATE_FIELDS = ['expiration_date', 'date_received', 'opened_date'];
const UI_ONLY_FIELDS = ['already_opened', 'opened_pack_remaining_content'];

const sanitizeItemPayload = (payload = {}) => {
  const next = { ...payload };

  for (const field of UI_ONLY_FIELDS) {
    delete next[field];
  }

  for (const field of DATE_FIELDS) {
    if (next[field] === '') {
      next[field] = null;
    }
  }

  return next;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toIntOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
};

const normalizeTrackingPayload = (payload = {}) => {
  const uiAlreadyOpened = payload?.already_opened;
  const next = sanitizeItemPayload(payload);
  const trackingType = next.tracking_type || 'SIMPLE_MEASURE';

  next.tracking_type = trackingType;

  if (trackingType === 'SIMPLE_MEASURE') {
    const quantityValue = toNumberOrNull(next.quantity_value) ?? toNumberOrNull(next.quantity) ?? 0;
    const quantityUnit = (next.quantity_unit || next.unit || '').trim();
    next.quantity_value = quantityValue;
    next.quantity_unit = quantityUnit;
    next.quantity = quantityValue;
    next.unit = quantityUnit;
    next.total_units = null;
    next.unit_type = null;
    next.content_per_unit = null;
    next.total_content = null;
    next.content_label = null;
    if (typeof uiAlreadyOpened === 'boolean') {
      next.opened_date = uiAlreadyOpened
        ? (next.opened_date || new Date().toISOString().slice(0, 10))
        : null;
    }
  } else if (trackingType === 'UNIT_ONLY') {
    const totalUnits = toIntOrNull(next.total_units) ?? toIntOrNull(next.quantity) ?? 0;
    const unitType = (next.unit_type || next.unit || '').trim();
    next.total_units = totalUnits;
    next.unit_type = unitType;
    next.quantity = totalUnits;
    next.unit = unitType;
    next.quantity_value = null;
    next.quantity_unit = null;
    next.content_per_unit = null;
    next.total_content = null;
    next.content_label = null;
    if (typeof uiAlreadyOpened === 'boolean') {
      next.opened_date = uiAlreadyOpened
        ? (next.opened_date || new Date().toISOString().slice(0, 10))
        : null;
    }
  } else {
    const totalUnits = toIntOrNull(next.total_units) ?? toIntOrNull(next.quantity) ?? 0;
    const contentPerUnit = toIntOrNull(next.content_per_unit) ?? 0;
    const unitType = (next.unit_type || next.unit || '').trim();
    const contentLabel = (next.content_label || 'pcs').trim();
    const totalContent = toIntOrNull(next.total_content) ?? (totalUnits * contentPerUnit);
    next.total_units = totalUnits;
    next.content_per_unit = contentPerUnit;
    next.unit_type = unitType;
    next.content_label = contentLabel || 'pcs';
    next.total_content = totalContent;
    next.quantity = totalUnits;
    next.unit = unitType;
    next.quantity_value = null;
    next.quantity_unit = null;
  }

  return next;
};

const ensureCategory = (payload, category) => ({
  ...normalizeTrackingPayload(payload),
  category,
});

const normalizeItem = (row) => ({
  ...row,
  tracking_type: row?.tracking_type || 'SIMPLE_MEASURE',
  quantity_value: row?.quantity_value,
  quantity_unit: row?.quantity_unit,
  unit_type: row?.unit_type,
  total_units: row?.total_units,
  content_per_unit: row?.content_per_unit,
  content_label: row?.content_label,
  total_content: row?.total_content,
  sealed_count: row?.sealed_count ?? null,
  opened_count: row?.opened_count ?? null,
  created_date: row?.created_date || row?.created_at || null,
  updated_date: row?.updated_date || row?.updated_at || null,
});

const ITEM_LIST_COLUMNS = [
  'id',
  'name',
  'category',
  'quantity',
  'unit',
  'tracking_type',
  'quantity_value',
  'quantity_unit',
  'unit_type',
  'total_units',
  'content_per_unit',
  'content_label',
  'total_content',
  'room_area',
  'storage_type',
  'storage_number',
  'position',
  'project_fund_source',
  'expiration_date',
  'minimum_stock',
  'qr_code_value',
  'description',
  'supplier',
  'status',
  'date_received',
  'lot_number',
  'opened_date',
  'location',
  'created_at',
  'updated_at',
].join(', ');

const withContainerStats = async (items = []) => {
  const packItems = items.filter((item) => item.tracking_type === 'PACK_WITH_CONTENT');
  if (packItems.length === 0) return items;

  const itemIds = packItems.map((item) => item.id);
  const { data: containers, error } = await supabase
    .from('item_containers')
    .select('item_id, status, sealed_count, opened_content_remaining')
    .in('item_id', itemIds);

  if (error) throw error;

  const stats = new Map();
  for (const row of containers || []) {
    if (!stats.has(row.item_id)) {
      stats.set(row.item_id, { sealed_count: 0, opened_count: 0 });
    }
    const current = stats.get(row.item_id);
    if (row.status === 'SEALED') {
      current.sealed_count = row.sealed_count || 0;
    } else if (row.status === 'OPENED') {
      current.opened_count += 1;
    }
  }

  return items.map((item) => {
    if (item.tracking_type !== 'PACK_WITH_CONTENT') return item;
    const current = stats.get(item.id) || { sealed_count: 0, opened_count: 0 };
    return {
      ...item,
      sealed_count: current.sealed_count,
      opened_count: current.opened_count,
    };
  });
};

export const listAllItems = async (limit = 1000) => {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const normalized = (data || []).map(normalizeItem);
  return withContainerStats(normalized);
};

export const listItemsByCategory = async (category, options = {}) => {
  const { limit = 1000, search = '' } = options;
  let query = supabase
    .from('items')
    .select(ITEM_LIST_COLUMNS)
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(limit);

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    query = query.or(
      [
        `name.ilike.%${trimmedSearch}%`,
        `room_area.ilike.%${trimmedSearch}%`,
        `storage_type.ilike.%${trimmedSearch}%`,
        `storage_number.ilike.%${trimmedSearch}%`,
        `position.ilike.%${trimmedSearch}%`,
        `lot_number.ilike.%${trimmedSearch}%`,
        `project_fund_source.ilike.%${trimmedSearch}%`,
        `supplier.ilike.%${trimmedSearch}%`,
      ].join(',')
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  const normalized = (data || []).map(normalizeItem);
  return withContainerStats(normalized);
};

export const createItemForCategory = async (category, payload) => {
  const prepared = ensureCategory(payload, category);
  const { data, error } = await supabase
    .from('items')
    .insert(prepared)
    .select('id, tracking_type, total_units')
    .single();

  if (error) throw error;

  if (prepared.tracking_type === 'PACK_WITH_CONTENT' && data?.id) {
    const totalUnits = prepared.total_units || 0;
    const alreadyOpened = Boolean(payload?.already_opened);
    const openedRemaining = toIntOrNull(payload?.opened_pack_remaining_content);
    const contentPerUnit = prepared.content_per_unit || 0;

    const setSealedRow = async (sealedCount) => {
      const { data: existingSealed, error: getSealedError } = await supabase
        .from('item_containers')
        .select('id')
        .eq('item_id', data.id)
        .eq('status', 'SEALED')
        .maybeSingle();
      if (getSealedError) throw getSealedError;

      if (existingSealed?.id) {
        const { error: updateSealedError } = await supabase
          .from('item_containers')
          .update({ sealed_count: sealedCount })
          .eq('id', existingSealed.id);
        if (updateSealedError) throw updateSealedError;
      } else {
        const { error: insertSealedError } = await supabase
          .from('item_containers')
          .insert({ item_id: data.id, status: 'SEALED', sealed_count: sealedCount });
        if (insertSealedError) throw insertSealedError;
      }
    };

    if (alreadyOpened && totalUnits > 0 && openedRemaining !== null && openedRemaining >= 0) {
      const sealedCount = Math.max(totalUnits - 1, 0);
      await setSealedRow(sealedCount);

      const { error: openedError } = await supabase
        .from('item_containers')
        .insert({
          item_id: data.id,
          status: 'OPENED',
          opened_content_remaining: openedRemaining,
        });
      if (openedError) throw openedError;

      const nextTotalContent = sealedCount * contentPerUnit + openedRemaining;
      const { error: updateItemError } = await supabase
        .from('items')
        .update({ total_content: nextTotalContent })
        .eq('id', data.id);
      if (updateItemError) throw updateItemError;
    } else {
      await setSealedRow(totalUnits);
    }
  }

  return data;
};

export const updateItemById = async (itemId, payload) => {
  const { error } = await supabase
    .from('items')
    .update(normalizeTrackingPayload(payload))
    .eq('id', itemId);

  if (error) throw error;
};

export const deleteItemById = async (itemId) => {
  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) throw error;
};

export const moveItemLocation = async (item, location) => {
  const payload = {
    room_area: location.room_area || item.room_area,
    storage_type: location.storage_type || item.storage_type,
    storage_number: location.storage_number || item.storage_number,
    position: location.position || item.position,
  };

  await updateItemById(item.id, payload);
};
