import { supabase } from '@/lib/supabaseClient';

export const generateIdempotencyKey = () => `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

const getActor = (userProfile, userName = null) => ({
  usedByName: userName || userProfile?.full_name || 'User',
  usedById: userProfile?.id || null,
});

const mapRpcResult = (data) => ({
  beforeQuantity: data?.before_quantity,
  afterQuantity: data?.after_quantity,
  quantityUsed: data?.quantity_used,
  quantityAdded: data?.quantity_added,
  quantityDelta: data?.quantity_delta,
  trackingType: data?.tracking_type,
  sealedCount: data?.sealed_count,
  openedCount: data?.opened_count,
  totalUnits: data?.total_units,
  totalContent: data?.total_content,
  quantityValue: data?.quantity_value,
  quantityUnit: data?.quantity_unit,
  idempotencyKey: data?.idempotency_key,
  action: data?.action,
  itemId: data?.item_id,
});

const callRpc = async (name, payload) => {
  const { data, error } = await supabase.rpc(name, payload);
  if (error) {
    throw new Error(error.message || 'RPC call failed');
  }
  return data || {};
};

export const safeUseItem = async ({
  itemId,
  quantityToUse = null,
  mode = 'CONTENT',
  amount = null,
  trackingType = null,
  wasOpened = false,
  userProfile = null,
  userName = null,
  notes = '',
  source = 'manual',
  studentId = null,
  experiment = null,
}) => {
  const actor = getActor(userProfile, userName);
  const idempotencyKey = generateIdempotencyKey();

  let data;
  if (source === 'manual') {
    const useAmount = amount ?? quantityToUse;
    data = await callRpc('use_deduct_item', {
      p_item_id: itemId,
      p_mode: mode,
      p_amount: useAmount,
      p_notes: notes,
      p_used_by_name: actor.usedByName,
      p_used_by_id: actor.usedById,
      p_source: source,
      p_student_id: studentId,
      p_experiment: experiment,
    });
  } else {
    data = await callRpc('rpc_safe_use_item', {
      p_item_id: itemId,
      p_quantity_to_use: quantityToUse,
      p_used_by_name: actor.usedByName,
      p_used_by_id: actor.usedById,
      p_notes: notes,
      p_source: source,
      p_student_id: studentId,
      p_experiment: experiment,
      p_idempotency_key: idempotencyKey,
    });
  }

  // For non-pack items, first deduct should mark item as opened.
  if (
    source === 'manual' &&
    (trackingType === 'SIMPLE_MEASURE' || trackingType === 'UNIT_ONLY') &&
    !wasOpened
  ) {
    const { error: openedUpdateError } = await supabase
      .from('items')
      .update({ opened_date: new Date().toISOString().slice(0, 10) })
      .eq('id', itemId)
      .is('opened_date', null);
    if (openedUpdateError) {
      throw new Error(openedUpdateError.message || 'Failed to mark item as opened');
    }
  }

  return {
    ...mapRpcResult(data),
    item: { id: data?.item_id },
  };
};

export const restockItem = async ({ itemId, quantityToAdd, userProfile, notes = '', source = 'manual' }) => {
  const actor = getActor(userProfile);
  const idempotencyKey = generateIdempotencyKey();

  const data = await callRpc('rpc_restock_item', {
    p_item_id: itemId,
    p_quantity_to_add: quantityToAdd,
    p_used_by_name: actor.usedByName,
    p_used_by_id: actor.usedById,
    p_notes: notes,
    p_source: source,
    p_idempotency_key: idempotencyKey,
  });

  return {
    ...mapRpcResult(data),
    item: { id: data?.item_id },
  };
};

export const adjustItemStock = async ({ itemId, newQuantity, userProfile, notes = '', source = 'manual' }) => {
  const actor = getActor(userProfile);
  const idempotencyKey = generateIdempotencyKey();

  const data = await callRpc('rpc_adjust_item_stock', {
    p_item_id: itemId,
    p_new_quantity: newQuantity,
    p_used_by_name: actor.usedByName,
    p_used_by_id: actor.usedById,
    p_notes: notes,
    p_source: source,
    p_idempotency_key: idempotencyKey,
  });

  return {
    ...mapRpcResult(data),
    item: { id: data?.item_id },
  };
};

export const disposeItem = async ({ itemId, userProfile, reason = '', notes = '' }) => {
  const actor = getActor(userProfile);
  const idempotencyKey = generateIdempotencyKey();

  const data = await callRpc('rpc_dispose_item', {
    p_item_id: itemId,
    p_used_by_name: actor.usedByName,
    p_used_by_id: actor.usedById,
    p_reason: reason,
    p_notes: notes,
    p_idempotency_key: idempotencyKey,
  });

  return {
    ...mapRpcResult(data),
    item: { id: data?.item_id },
  };
};

export const archiveItem = async (itemId) => {
  const { error } = await supabase.from('items').update({ status: 'archived' }).eq('id', itemId);
  if (error) throw new Error(error.message || 'Failed to archive item');
};

export const restoreItem = async (itemId) => {
  const { error } = await supabase
    .from('items')
    .update({
      status: 'active',
      disposed_at: null,
      disposed_reason: null,
      disposed_by_id: null,
    })
    .eq('id', itemId);

  if (error) throw new Error(error.message || 'Failed to restore item');
};

export const generatePin = (length = 6) => {
  const chars = '0123456789';
  let pin = '';
  for (let i = 0; i < length; i++) pin += chars.charAt(Math.floor(Math.random() * chars.length));
  return pin;
};
