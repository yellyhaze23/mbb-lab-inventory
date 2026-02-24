# MSDS Feature Notes

## Overview
This implementation adds versioned MSDS support for chemicals (stored in `items` where `category='chemical'`):
- Private storage bucket (`msds`)
- Version table (`msds_documents`)
- Current MSDS pointer on chemical (`items.msds_current_id`)
- Audit logs (`msds_audit_logs`)
- Signed URL edge function (`msds-signed-url`)
- UI for view/download/history/upload/replace/remove

## 1) Create/Update Database Schema
Migration file:
- `supabase/migrations/20260224100000_msds_feature.sql`

Apply migrations:
```bash
supabase db push
```

## 2) Storage Bucket
Bucket is created by the migration:
- Bucket ID: `msds`
- Private: `true`
- Size limit: `15MB`
- MIME allowed: `application/pdf`

File path convention used by app:
```text
msds/{chemical_id}/{msds_id}/msds.pdf
```

Internally (within bucket), object key is:
```text
{chemical_id}/{msds_id}/msds.pdf
```

## 3) Deploy Edge Function
Function path:
- `supabase/functions/msds-signed-url/index.ts`

Deploy:
```bash
supabase functions deploy msds-signed-url
```

Required env vars in Supabase project:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4) Role Check Behavior
Role check uses existing `profiles` table:
- Allowed for signed URL access: active authenticated users (`profiles.is_active = true`) for view/download
- Admin-only mutate actions in UI/API rely on:
  - `role in ('admin','super_admin')`

RLS summary:
- `msds_documents`:
  - `select`: active authenticated users
  - `insert/update/delete`: admin/super_admin
- `msds_audit_logs`:
  - `select`: admin/super_admin
  - `insert`: admin/super_admin (edge function inserts with service role)

Storage policies (`storage.objects`, bucket `msds`):
- `select`: active authenticated users
- `insert/update/delete`: admin/super_admin

## 5) Frontend Integration Points
- Service layer: `src/api/msdsService.ts`
- Types: `src/types/msds.ts`
- Viewer modal: `src/components/inventory/MsdsViewerModal.tsx`
- History modal: `src/components/inventory/MsdsHistoryModal.tsx`
- Upload/replace dialog: `src/components/inventory/MsdsUploadDialog.tsx`
- Chemicals page integration: `src/pages/Chemicals.jsx`
- Table row actions integration: `src/components/inventory/ItemsTableWithSelection.jsx`
- Drawer MSDS section: `src/components/inventory/ItemDetailDrawer.jsx`
- Add Chemical optional MSDS section: `src/components/inventory/ItemForm.jsx`

## 6) Validation Rules
- PDF only (`MIME` or `.pdf` extension)
- Max file size: `15MB`
- Signed URL expiry: `180s` (edge function)

## 7) Audit Actions
Actions logged:
- `UPLOAD`
- `REPLACE`
- `REMOVE`
- `VIEW` (from edge function)
- `DOWNLOAD` (from edge function)

