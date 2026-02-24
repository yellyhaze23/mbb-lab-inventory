create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Items: current MSDS pointer (items table is the chemical source table)
-- -------------------------------------------------------------------
alter table public.items
  add column if not exists msds_current_id uuid;

-- -------------------------------------------------------------------
-- Versioned MSDS documents
-- -------------------------------------------------------------------
create table if not exists public.msds_documents (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid not null references public.items(id) on delete cascade,
  version integer not null default 1,
  title text,
  supplier text,
  revision_date date,
  language text not null default 'EN',
  file_path text not null,
  file_name text,
  file_size bigint,
  file_hash text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint msds_documents_version_positive check (version > 0)
);

create index if not exists idx_msds_documents_chemical_id on public.msds_documents(chemical_id);
create unique index if not exists uq_msds_documents_chemical_version on public.msds_documents(chemical_id, version);
create index if not exists idx_msds_documents_active on public.msds_documents(chemical_id, uploaded_at desc) where is_active = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_msds_current_id_fkey'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_msds_current_id_fkey
      foreign key (msds_current_id)
      references public.msds_documents(id)
      on delete set null;
  end if;
end $$;

-- Ensure the current pointer can only point to a document owned by the same item.
create or replace function public.validate_item_msds_current()
returns trigger
language plpgsql
as $$
declare
  v_chemical_id uuid;
begin
  if new.msds_current_id is null then
    return new;
  end if;

  select chemical_id
  into v_chemical_id
  from public.msds_documents
  where id = new.msds_current_id;

  if v_chemical_id is null then
    raise exception 'Invalid msds_current_id: document does not exist';
  end if;

  if v_chemical_id <> new.id then
    raise exception 'msds_current_id must belong to the same item';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_items_validate_msds_current on public.items;
create trigger trg_items_validate_msds_current
before insert or update of msds_current_id on public.items
for each row
execute function public.validate_item_msds_current();

-- -------------------------------------------------------------------
-- MSDS audit logs
-- -------------------------------------------------------------------
create table if not exists public.msds_audit_logs (
  id uuid primary key default gen_random_uuid(),
  chemical_id uuid references public.items(id) on delete set null,
  msds_id uuid references public.msds_documents(id) on delete set null,
  action text not null check (action in ('UPLOAD', 'REPLACE', 'REMOVE', 'VIEW', 'DOWNLOAD')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_msds_audit_logs_chemical on public.msds_audit_logs(chemical_id, created_at desc);
create index if not exists idx_msds_audit_logs_msds on public.msds_audit_logs(msds_id, created_at desc);
create index if not exists idx_msds_audit_logs_actor on public.msds_audit_logs(actor_id, created_at desc);

drop trigger if exists trg_msds_documents_set_updated_at on public.msds_documents;
create trigger trg_msds_documents_set_updated_at
before update on public.msds_documents
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------
alter table public.msds_documents enable row level security;
alter table public.msds_audit_logs enable row level security;

drop policy if exists msds_documents_select_authenticated_active on public.msds_documents;
create policy msds_documents_select_authenticated_active
on public.msds_documents
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists msds_documents_mutate_admin on public.msds_documents;
create policy msds_documents_mutate_admin
on public.msds_documents
for all
to authenticated
using (public.is_admin_or_super_admin())
with check (public.is_admin_or_super_admin());

drop policy if exists msds_audit_logs_select_admin on public.msds_audit_logs;
create policy msds_audit_logs_select_admin
on public.msds_audit_logs
for select
to authenticated
using (public.is_admin_or_super_admin());

drop policy if exists msds_audit_logs_insert_admin on public.msds_audit_logs;
create policy msds_audit_logs_insert_admin
on public.msds_audit_logs
for insert
to authenticated
with check (public.is_admin_or_super_admin());

drop policy if exists msds_audit_logs_mutate_super_admin on public.msds_audit_logs;
create policy msds_audit_logs_mutate_super_admin
on public.msds_audit_logs
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- -------------------------------------------------------------------
-- Private storage bucket + policies
-- -------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('msds', 'msds', false, 15728640, array['application/pdf']::text[])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists msds_objects_select_active on storage.objects;
create policy msds_objects_select_active
on storage.objects
for select
to authenticated
using (
  bucket_id = 'msds'
  and public.is_active_authenticated_user()
);

drop policy if exists msds_objects_insert_admin on storage.objects;
create policy msds_objects_insert_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'msds'
  and public.is_admin_or_super_admin()
);

drop policy if exists msds_objects_update_admin on storage.objects;
create policy msds_objects_update_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'msds'
  and public.is_admin_or_super_admin()
)
with check (
  bucket_id = 'msds'
  and public.is_admin_or_super_admin()
);

drop policy if exists msds_objects_delete_admin on storage.objects;
create policy msds_objects_delete_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'msds'
  and public.is_admin_or_super_admin()
);
