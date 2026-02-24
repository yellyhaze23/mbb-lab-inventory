import { supabase } from '@/lib/supabaseClient';
import { invokeEdgeFunction } from '@/lib/edgeClient';
import type { MsdsDocument } from '@/types/msds';

const MAX_PDF_BYTES = 15 * 1024 * 1024;

type UploadPayload = {
  chemicalId: string;
  file: File;
  title?: string;
  supplier?: string;
  revisionDate?: string;
  language?: string;
  action?: 'UPLOAD' | 'REPLACE';
};

export function isAdminProfile(profile?: { role?: string | null } | null) {
  return Boolean(profile?.role && ['admin', 'super_admin'].includes(profile.role));
}

export function validateMsdsFile(file?: File | null) {
  if (!file) {
    return { valid: false, message: 'Please select a PDF file.' };
  }

  const hasPdfMime = file.type === 'application/pdf';
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  if (!hasPdfMime && !hasPdfExtension) {
    return { valid: false, message: 'Only PDF files are allowed.' };
  }

  if (file.size <= 0) {
    return { valid: false, message: 'File is empty.' };
  }

  if (file.size > MAX_PDF_BYTES) {
    return { valid: false, message: 'PDF exceeds 15MB limit.' };
  }

  return { valid: true, message: null };
}

async function computeFileHash(file: File) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function insertAuditLog(payload: {
  chemical_id: string | null;
  msds_id: string | null;
  action: 'UPLOAD' | 'REPLACE' | 'REMOVE';
  actor_id?: string | null;
  meta?: Record<string, unknown>;
}) {
  const { error } = await supabase.from('msds_audit_logs').insert({
    ...payload,
    meta: payload.meta || {},
  });

  if (error) throw error;
}

async function getNextVersion(chemicalId: string) {
  const { data, error } = await supabase
    .from('msds_documents')
    .select('version')
    .eq('chemical_id', chemicalId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.version || 0) + 1;
}

export async function listMsdsHistory(chemicalId: string) {
  const { data, error } = await supabase
    .from('msds_documents')
    .select('id, chemical_id, version, title, supplier, revision_date, language, file_path, file_name, file_size, file_hash, uploaded_by, uploaded_at, is_active')
    .eq('chemical_id', chemicalId)
    .order('version', { ascending: false });

  if (error) throw error;
  const docs = (data || []) as MsdsDocument[];

  const uploaderIds = [...new Set(docs.map((d) => d.uploaded_by).filter(Boolean))] as string[];
  if (uploaderIds.length === 0) return docs;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', uploaderIds);

  const byId = new Map((profiles || []).map((p) => [p.id, p.full_name || p.email || p.id]));
  return docs.map((d) => ({
    ...d,
    uploaded_by_name: d.uploaded_by ? (byId.get(d.uploaded_by) || d.uploaded_by) : null,
  }));
}

export async function uploadMsdsVersion(payload: UploadPayload) {
  const validation = validateMsdsFile(payload.file);
  if (!validation.valid) throw new Error(validation.message || 'Invalid MSDS file');

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Please log in again.');

  const version = await getNextVersion(payload.chemicalId);
  const fileHash = await computeFileHash(payload.file);
  const fileName = payload.file.name;

  const { data: created, error: createErr } = await supabase
    .from('msds_documents')
    .insert({
      chemical_id: payload.chemicalId,
      version,
      title: payload.title || null,
      supplier: payload.supplier || null,
      revision_date: payload.revisionDate || null,
      language: payload.language || 'EN',
      file_path: `pending/${payload.chemicalId}/${Date.now()}`,
      file_name: fileName,
      file_size: payload.file.size,
      file_hash: fileHash,
      uploaded_by: user.id,
      is_active: true,
    })
    .select('id, chemical_id, version, title, supplier, revision_date, language, file_path, file_name, file_size, file_hash, uploaded_by, uploaded_at, is_active')
    .single();

  if (createErr || !created) throw createErr || new Error('Failed to create MSDS version');

  const storagePath = `${payload.chemicalId}/${created.id}/msds.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('msds')
    .upload(storagePath, payload.file, {
      cacheControl: '3600',
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadErr) {
    await supabase.from('msds_documents').delete().eq('id', created.id);
    throw uploadErr;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('msds_documents')
    .update({
      file_path: storagePath,
      file_name: fileName,
      file_size: payload.file.size,
      file_hash: fileHash,
    })
    .eq('id', created.id)
    .select('id, chemical_id, version, title, supplier, revision_date, language, file_path, file_name, file_size, file_hash, uploaded_by, uploaded_at, is_active')
    .single();

  if (updateErr || !updated) throw updateErr || new Error('Failed to finalize MSDS version');

  const { error: pointerErr } = await supabase
    .from('items')
    .update({ msds_current_id: updated.id })
    .eq('id', payload.chemicalId);

  if (pointerErr) throw pointerErr;

  await insertAuditLog({
    chemical_id: payload.chemicalId,
    msds_id: updated.id,
    action: payload.action || (version === 1 ? 'UPLOAD' : 'REPLACE'),
    actor_id: user.id,
    meta: {
      version: updated.version,
      file_name: updated.file_name,
      file_size: updated.file_size,
      revision_date: updated.revision_date,
    },
  });

  return updated as MsdsDocument;
}

export async function removeCurrentMsds(chemicalId: string, options?: { archiveCurrent?: boolean }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: item, error: itemErr } = await supabase
    .from('items')
    .select('id, msds_current_id')
    .eq('id', chemicalId)
    .maybeSingle();

  if (itemErr) throw itemErr;
  if (!item?.id) throw new Error('Chemical not found.');

  const currentMsdsId = item.msds_current_id || null;
  const { error: detachErr } = await supabase
    .from('items')
    .update({ msds_current_id: null })
    .eq('id', chemicalId);
  if (detachErr) throw detachErr;

  if (options?.archiveCurrent && currentMsdsId) {
    const { error: archiveErr } = await supabase
      .from('msds_documents')
      .update({ is_active: false })
      .eq('id', currentMsdsId);
    if (archiveErr) throw archiveErr;
  }

  await insertAuditLog({
    chemical_id: chemicalId,
    msds_id: currentMsdsId,
    action: 'REMOVE',
    actor_id: user?.id || null,
    meta: { archived: Boolean(options?.archiveCurrent) },
  });
}

export async function setCurrentMsds(chemicalId: string, msdsId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('items')
    .update({ msds_current_id: msdsId })
    .eq('id', chemicalId);

  if (error) throw error;

  await insertAuditLog({
    chemical_id: chemicalId,
    msds_id: msdsId,
    action: 'REPLACE',
    actor_id: user?.id || null,
    meta: { source: 'set_current' },
  });
}

export async function archiveMsdsVersion(msdsId: string) {
  const { error } = await supabase
    .from('msds_documents')
    .update({ is_active: false })
    .eq('id', msdsId);

  if (error) throw error;
}

export async function getSignedMsdsUrl(msdsId: string, mode: 'view' | 'download') {
  const data = await invokeEdgeFunction(
    'msds-signed-url',
    { msds_id: msdsId, mode },
    { requireAuth: true }
  );
  if (!data?.signed_url) throw new Error('Failed to generate secure MSDS URL.');
  return data.signed_url as string;
}

