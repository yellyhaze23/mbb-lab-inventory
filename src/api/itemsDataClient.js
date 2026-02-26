import { supabase } from '@/lib/supabaseClient';
import {
  getDefaultContentUnitForCategory,
  isValidContentUnitForCategory,
  TRACKING_TYPES,
} from '@/constants/measurement';

const DATE_FIELDS = ['expiration_date', 'date_received', 'opened_date'];
const UI_ONLY_FIELDS = ['already_opened', 'opened_pack_remaining_content', 'opened_units_count'];

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
  const trackingType = next.tracking_type || TRACKING_TYPES.SIMPLE_MEASURE;
  const category = next.category;

  next.tracking_type = trackingType;

  if (trackingType === TRACKING_TYPES.SIMPLE_MEASURE) {
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
    next.content_unit = null;
    next.total_content_unit = null;
  } else if (trackingType === TRACKING_TYPES.UNIT_ONLY) {
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
    next.content_unit = null;
    next.total_content_unit = null;
    if (typeof uiAlreadyOpened === 'boolean') {
      next.opened_date = uiAlreadyOpened
        ? (next.opened_date || new Date().toISOString().slice(0, 10))
        : null;
    }
  } else {
    const totalUnits = toIntOrNull(next.total_units) ?? toIntOrNull(next.quantity) ?? 0;
    const contentPerUnit = toNumberOrNull(next.content_per_unit) ?? 0;
    const unitType = (next.unit_type || next.unit || '').trim();
    const contentUnit = String(next.content_unit || next.total_content_unit || next.content_label || getDefaultContentUnitForCategory(category)).trim();
    const totalContent = toNumberOrNull(next.total_content) ?? (totalUnits * contentPerUnit);
    next.total_units = totalUnits;
    next.content_per_unit = contentPerUnit;
    next.unit_type = unitType;
    next.content_unit = contentUnit;
    next.total_content_unit = contentUnit;
    next.content_label = contentUnit; // Legacy compatibility.
    next.total_content = totalContent;
    next.quantity = totalUnits;
    next.unit = unitType;
    next.quantity_value = null;
    next.quantity_unit = null;
    if (typeof uiAlreadyOpened === 'boolean') {
      next.opened_date = uiAlreadyOpened
        ? (next.opened_date || new Date().toISOString().slice(0, 10))
        : null;
    }
  }

  if (trackingType === TRACKING_TYPES.PACK_WITH_CONTENT) {
    if ((next.total_units ?? 0) < 1) {
      throw new Error('Total units must be at least 1');
    }
    if ((next.content_per_unit ?? 0) <= 0) {
      throw new Error('Content per unit must be greater than 0');
    }
    if (!isValidContentUnitForCategory(category, next.content_unit)) {
      throw new Error(`Invalid content unit "${next.content_unit}" for ${category}`);
    }
  }

  return next;
};

const ensureCategory = (payload, category) => (
  normalizeTrackingPayload({
    ...payload,
    category,
  })
);

const normalizeItem = (row) => ({
  ...row,
  tracking_type: row?.tracking_type || TRACKING_TYPES.SIMPLE_MEASURE,
  quantity_value: row?.quantity_value,
  quantity_unit: row?.quantity_unit,
  unit_type: row?.unit_type,
  total_units: row?.total_units,
  content_per_unit: row?.content_per_unit,
  content_unit: row?.content_unit || row?.total_content_unit || row?.content_label || null,
  content_label: row?.content_label || row?.content_unit || row?.total_content_unit || null,
  total_content_unit: row?.total_content_unit || row?.content_unit || row?.content_label || null,
  total_content: row?.total_content,
  opened_units: row?.opened_units ?? null,
  sealed_units: row?.sealed_units ?? null,
  status_summary: row?.status_summary ?? null,
  needs_measurement_data: Boolean(row?.needs_measurement_data),
  sealed_count: row?.sealed_count ?? null,
  opened_count: row?.opened_count ?? null,
  empty_count: row?.empty_count ?? null,
  created_date: row?.created_date || row?.created_at || null,
  updated_date: row?.updated_date || row?.updated_at || null,
  msds_current_id: row?.msds_current_id || null,
  msds_current: row?.msds_current || null,
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
  'content_unit',
  'total_content_unit',
  'content_label',
  'total_content',
  'opened_units',
  'sealed_units',
  'status_summary',
  'needs_measurement_data',
  'room_area',
  'storage_type',
  'storage_number',
  'position',
  'project_fund_source',
  'expiration_date',
  'minimum_stock',
  'description',
  'supplier',
  'status',
  'date_received',
  'lot_number',
  'opened_date',
  'location',
  'msds_current_id',
  'msds_current:msds_current_id(id, version, title, supplier, revision_date, language, file_name, file_size, uploaded_at, is_active)',
  'created_at',
  'updated_at',
].join(', ');

const LEGACY_ITEM_LIST_COLUMNS = [
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
  'description',
  'supplier',
  'status',
  'date_received',
  'lot_number',
  'opened_date',
  'location',
  'msds_current_id',
  'msds_current:msds_current_id(id, version, title, supplier, revision_date, language, file_name, file_size, uploaded_at, is_active)',
  'created_at',
  'updated_at',
].join(', ');

const isSchemaMismatchError = (error) => {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  return (
    message.includes('Could not find') ||
    message.includes('column') ||
    message.includes('does not exist') ||
    details.includes('does not exist')
  );
};

const runItemListQuery = async (buildQuery) => {
  let result = await buildQuery(ITEM_LIST_COLUMNS);
  if (!result.error) return result;
  if (!isSchemaMismatchError(result.error)) return result;
  result = await buildQuery(LEGACY_ITEM_LIST_COLUMNS);
  return result;
};

const toDesiredOpenedCount = (payload = {}, totalUnits = 0) => {
  if (typeof payload?.already_opened !== 'boolean') return null;
  if (!payload.already_opened) return 0;
  const requested = toIntOrNull(payload?.opened_units_count);
  if (!Number.isFinite(requested) || requested <= 0) return Math.min(1, Math.max(0, totalUnits));
  return Math.max(0, Math.min(requested, totalUnits));
};

const syncPackContainerOpenCount = async (itemId, desiredOpenedCount) => {
  if (!itemId || desiredOpenedCount === null || desiredOpenedCount === undefined) return;

  let { data: containers, error } = await supabase
    .from('item_containers')
    .select('id, status, container_index')
    .eq('item_id', itemId)
    .order('container_index', { ascending: true });

  if (error && isSchemaMismatchError(error)) {
    const retry = await supabase
      .from('item_containers')
      .select('id, status')
      .eq('item_id', itemId);
    containers = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  if (!containers || containers.length === 0) return;

  const editable = containers.filter((c) => {
    const status = String(c.status || '').toLowerCase();
    return status === 'opened' || status === 'sealed';
  });

  if (editable.length === 0) return;

  const targetOpened = Math.max(0, Math.min(desiredOpenedCount, editable.length));
  const opened = editable.filter((c) => String(c.status || '').toLowerCase() === 'opened');
  const sealed = editable.filter((c) => String(c.status || '').toLowerCase() === 'sealed');

  if (opened.length < targetOpened) {
    const toOpen = sealed.slice(0, targetOpened - opened.length).map((c) => c.id);
    if (toOpen.length > 0) {
      const { error: openError } = await supabase
        .from('item_containers')
        .update({ status: 'opened' })
        .in('id', toOpen);
      if (openError) throw openError;
    }
  } else if (opened.length > targetOpened) {
    const toSeal = opened.slice(targetOpened).map((c) => c.id);
    if (toSeal.length > 0) {
      const { error: sealError } = await supabase
        .from('item_containers')
        .update({ status: 'sealed' })
        .in('id', toSeal);
      if (sealError) throw sealError;
    }
  }
};

const withContainerStats = async (items = []) => {
  const packItems = items.filter((item) => item.tracking_type === TRACKING_TYPES.PACK_WITH_CONTENT);
  if (packItems.length === 0) return items;

  const itemIds = packItems.map((item) => item.id);
  let { data: containers, error } = await supabase
    .from('item_containers')
    .select('item_id, status, remaining_content')
    .in('item_id', itemIds);

  if (error && isSchemaMismatchError(error)) {
    const retry = await supabase
      .from('item_containers')
      .select('item_id, status, sealed_count, opened_content_remaining')
      .in('item_id', itemIds);
    containers = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  const stats = new Map();
  for (const row of containers || []) {
    if (!stats.has(row.item_id)) {
      stats.set(row.item_id, { sealed_count: 0, opened_count: 0, empty_count: 0 });
    }
    const current = stats.get(row.item_id);
    const normalizedStatus = String(row.status || '').toLowerCase();
    if (normalizedStatus === 'sealed') {
      current.sealed_count += Number(row.sealed_count || 1);
    } else if (normalizedStatus === 'opened') {
      current.opened_count += 1;
    } else if (normalizedStatus === 'empty') {
      current.empty_count += 1;
    }
  }

  return items.map((item) => {
    if (item.tracking_type !== TRACKING_TYPES.PACK_WITH_CONTENT) return item;
    const current = stats.get(item.id) || { sealed_count: 0, opened_count: 0, empty_count: 0 };
    let sealedCount = current.sealed_count;
    let openedCount = current.opened_count;
    const emptyCount = current.empty_count;

    // Fallback: if item is marked opened but container stats still show all sealed,
    // reflect at least one opened container in UI counts.
    if (item.opened_date && openedCount === 0) {
      if (sealedCount > 0) {
        sealedCount -= 1;
        openedCount = 1;
      } else if ((Number(item.total_units) || 0) > emptyCount) {
        openedCount = 1;
      }
    }

    return {
      ...item,
      sealed_count: sealedCount,
      opened_count: openedCount,
      empty_count: emptyCount,
    };
  });
};

export const listAllItems = async (limit = 1000) => {
  const { data, error } = await runItemListQuery((columns) => (
    supabase
      .from('items')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(limit)
  ));

  if (error) throw error;
  const normalized = (data || []).map(normalizeItem);
  return withContainerStats(normalized);
};

export const listItemsByCategory = async (category, options = {}) => {
  const { limit = 1000, search = '' } = options;
  const trimmedSearch = search.trim();
  const { data, error } = await runItemListQuery((columns) => {
    let query = supabase
      .from('items')
      .select(columns)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(limit);

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

    return query;
  });

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

  const desiredOpened = toDesiredOpenedCount(payload, Number(prepared.total_units) || 0);
  if (prepared.tracking_type === TRACKING_TYPES.PACK_WITH_CONTENT && desiredOpened !== null) {
    await syncPackContainerOpenCount(data?.id, desiredOpened);
  }

  return data;
};

export const updateItemById = async (itemId, payload) => {
  const prepared = normalizeTrackingPayload(payload);
  const { error } = await supabase
    .from('items')
    .update(prepared)
    .eq('id', itemId);

  if (error) throw error;

  const desiredOpened = toDesiredOpenedCount(payload, Number(prepared.total_units) || 0);
  if (prepared.tracking_type === TRACKING_TYPES.PACK_WITH_CONTENT && desiredOpened !== null) {
    await syncPackContainerOpenCount(itemId, desiredOpened);
  }
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
