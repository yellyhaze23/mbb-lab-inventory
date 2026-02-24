export interface MsdsDocument {
  id: string;
  chemical_id: string;
  version: number;
  title: string | null;
  supplier: string | null;
  revision_date: string | null;
  language: string;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  file_hash: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  is_active: boolean;
  uploaded_by_name?: string | null;
}

export interface MsdsAuditLog {
  id: string;
  chemical_id: string | null;
  msds_id: string | null;
  action: 'UPLOAD' | 'REPLACE' | 'REMOVE' | 'VIEW' | 'DOWNLOAD';
  actor_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
}

