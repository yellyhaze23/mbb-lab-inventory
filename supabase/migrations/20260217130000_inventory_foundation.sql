-- Step 1 foundation for Supabase migration:
-- tables, indexes, constraints, RLS, triggers, and inventory RPCs.

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Core tables
-- -------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('chemical', 'consumable')),
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null,
  room_area text not null,
  storage_type text not null,
  storage_number text,
  position text,
  location text, -- legacy display fallback
  project_fund_source text,
  expiration_date date,
  minimum_stock numeric not null default 0 check (minimum_stock >= 0),
  qr_code_value text,
  description text,
  supplier text,
  status text not null default 'active' check (status in ('active', 'archived', 'disposed')),
  date_received date,
  lot_number text,
  opened_date date,
  disposed_at timestamptz,
  disposed_reason text,
  disposed_by_id uuid references public.profiles(id) on delete set null,
  created_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  item_name text not null,
  item_type text not null check (item_type in ('chemical', 'consumable')),
  quantity_used numeric not null,
  unit text,
  used_by_name text,
  used_by_id uuid references public.profiles(id) on delete set null,
  notes text,
  before_quantity numeric not null check (before_quantity >= 0),
  after_quantity numeric not null check (after_quantity >= 0),
  action text not null default 'use' check (action in ('use', 'restock', 'adjust', 'dispose')),
  source text not null default 'manual' check (source in ('scan', 'manual', 'student_mode')),
  idempotency_key text not null,
  student_id text,
  experiment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lab_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true check (singleton = true),
  lab_name text not null default 'Lab',
  lab_description text,
  address text,
  contact_email text,
  contact_phone text,
  lab_pin_hash text,
  lab_pin_salt text,
  pin_expires_at timestamptz,
  pin_updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- -------------------------------------------------------------------
-- Indexes and constraints
-- -------------------------------------------------------------------

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_is_active on public.profiles(is_active);

create index if not exists idx_items_category on public.items(category);
create index if not exists idx_items_status on public.items(status);
create index if not exists idx_items_category_status on public.items(category, status);
create index if not exists idx_items_name on public.items(name);
create index if not exists idx_items_expiration_date on public.items(expiration_date);

create index if not exists idx_usage_logs_item_id on public.usage_logs(item_id);
create index if not exists idx_usage_logs_action on public.usage_logs(action);
create index if not exists idx_usage_logs_source on public.usage_logs(source);
create index if not exists idx_usage_logs_created_at_desc on public.usage_logs(created_at desc);
create unique index if not exists uq_usage_logs_idempotency_key on public.usage_logs(idempotency_key);

create unique index if not exists uq_lab_settings_singleton_true
  on public.lab_settings(singleton)
  where singleton = true;

-- -------------------------------------------------------------------
-- Shared helper functions and triggers
-- -------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_items_set_updated_at on public.items;
create trigger trg_items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists trg_usage_logs_set_updated_at on public.usage_logs;
create trigger trg_usage_logs_set_updated_at
before update on public.usage_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_lab_settings_set_updated_at on public.lab_settings;
create trigger trg_lab_settings_set_updated_at
before update on public.lab_settings
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------
-- Profile bootstrap trigger from auth.users
-- First user gets super_admin, everyone else gets admin.
-- -------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_super_admin boolean;
  v_full_name text;
begin
  perform pg_advisory_xact_lock(42424201);

  select exists (
    select 1
    from public.profiles
    where role = 'super_admin'
  )
  into v_has_super_admin;

  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'User'
  );

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    v_full_name,
    case when v_has_super_admin then 'admin' else 'super_admin' end,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- -------------------------------------------------------------------
-- Auth helper functions for RLS
-- -------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = 'super_admin'
  );
$$;

create or replace function public.is_admin_or_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_active_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
  );
$$;

-- -------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.usage_logs enable row level security;
alter table public.lab_settings enable row level security;

-- profiles
drop policy if exists profiles_select_own_or_super_admin on public.profiles;
create policy profiles_select_own_or_super_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update_own_or_super_admin on public.profiles;
create policy profiles_update_own_or_super_admin
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

-- items
drop policy if exists items_select_authenticated_active on public.items;
create policy items_select_authenticated_active
on public.items
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists items_mutate_admin on public.items;
create policy items_mutate_admin
on public.items
for all
to authenticated
using (public.is_admin_or_super_admin())
with check (public.is_admin_or_super_admin());

-- usage_logs
drop policy if exists usage_logs_select_authenticated_active on public.usage_logs;
create policy usage_logs_select_authenticated_active
on public.usage_logs
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists usage_logs_insert_admin on public.usage_logs;
create policy usage_logs_insert_admin
on public.usage_logs
for insert
to authenticated
with check (public.is_admin_or_super_admin());

drop policy if exists usage_logs_update_delete_super_admin on public.usage_logs;
create policy usage_logs_update_delete_super_admin
on public.usage_logs
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- lab_settings
drop policy if exists lab_settings_select_admin on public.lab_settings;
create policy lab_settings_select_admin
on public.lab_settings
for select
to authenticated
using (public.is_admin_or_super_admin());

drop policy if exists lab_settings_mutate_admin on public.lab_settings;
create policy lab_settings_mutate_admin
on public.lab_settings
for all
to authenticated
using (public.is_admin_or_super_admin())
with check (public.is_admin_or_super_admin());

-- Never expose pin hash/salt to anonymous or regular authenticated table reads.
revoke all on table public.lab_settings from anon;
grant select, insert, update on table public.lab_settings to authenticated;
revoke select (lab_pin_hash, lab_pin_salt) on public.lab_settings from authenticated;

-- -------------------------------------------------------------------
-- Inventory RPCs with row locking
-- -------------------------------------------------------------------

create or replace function public.rpc_safe_use_item(
  p_item_id uuid,
  p_quantity_to_use numeric,
  p_used_by_name text default null,
  p_used_by_id uuid default null,
  p_notes text default '',
  p_source text default 'manual',
  p_student_id text default null,
  p_experiment text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_existing public.usage_logs%rowtype;
  v_before numeric;
  v_after numeric;
  v_key text;
begin
  if p_quantity_to_use is null or p_quantity_to_use <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  v_key := coalesce(nullif(p_idempotency_key, ''), gen_random_uuid()::text);

  select *
  into v_existing
  from public.usage_logs
  where idempotency_key = v_key
  limit 1;

  if found then
    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'quantity_used', abs(v_existing.quantity_used),
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
  end if;

  select *
  into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  if v_item.status = 'disposed' then
    raise exception 'This item has been disposed and cannot be used';
  end if;

  if v_item.status = 'archived' then
    raise exception 'This item is archived and cannot be used';
  end if;

  if p_quantity_to_use > v_item.quantity then
    raise exception 'Insufficient stock. Available: % %', v_item.quantity, v_item.unit;
  end if;

  v_before := v_item.quantity;
  v_after := v_item.quantity - p_quantity_to_use;

  insert into public.usage_logs (
    item_id,
    item_name,
    item_type,
    quantity_used,
    unit,
    used_by_name,
    used_by_id,
    notes,
    before_quantity,
    after_quantity,
    action,
    source,
    idempotency_key,
    student_id,
    experiment
  )
  values (
    v_item.id,
    v_item.name,
    v_item.category,
    p_quantity_to_use,
    v_item.unit,
    coalesce(p_used_by_name, 'User'),
    p_used_by_id,
    coalesce(p_notes, ''),
    v_before,
    v_after,
    'use',
    coalesce(p_source, 'manual'),
    v_key,
    p_student_id,
    p_experiment
  );

  update public.items
  set quantity = v_after
  where id = v_item.id;

  return jsonb_build_object(
    'item_id', v_item.id,
    'before_quantity', v_before,
    'after_quantity', v_after,
    'quantity_used', p_quantity_to_use,
    'action', 'use',
    'idempotency_key', v_key
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.usage_logs
    where idempotency_key = v_key
    limit 1;

    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'quantity_used', abs(v_existing.quantity_used),
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
end;
$$;

create or replace function public.rpc_restock_item(
  p_item_id uuid,
  p_quantity_to_add numeric,
  p_used_by_name text default null,
  p_used_by_id uuid default null,
  p_notes text default '',
  p_source text default 'manual',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_existing public.usage_logs%rowtype;
  v_before numeric;
  v_after numeric;
  v_key text;
begin
  if p_quantity_to_add is null or p_quantity_to_add <= 0 then
    raise exception 'Quantity to add must be greater than 0';
  end if;

  v_key := coalesce(nullif(p_idempotency_key, ''), gen_random_uuid()::text);

  select *
  into v_existing
  from public.usage_logs
  where idempotency_key = v_key
  limit 1;

  if found then
    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'quantity_added', abs(v_existing.quantity_used),
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
  end if;

  select *
  into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  v_before := v_item.quantity;
  v_after := v_item.quantity + p_quantity_to_add;

  insert into public.usage_logs (
    item_id,
    item_name,
    item_type,
    quantity_used,
    unit,
    used_by_name,
    used_by_id,
    notes,
    before_quantity,
    after_quantity,
    action,
    source,
    idempotency_key
  )
  values (
    v_item.id,
    v_item.name,
    v_item.category,
    -p_quantity_to_add,
    v_item.unit,
    coalesce(p_used_by_name, 'User'),
    p_used_by_id,
    coalesce(p_notes, ''),
    v_before,
    v_after,
    'restock',
    coalesce(p_source, 'manual'),
    v_key
  );

  update public.items
  set quantity = v_after
  where id = v_item.id;

  return jsonb_build_object(
    'item_id', v_item.id,
    'before_quantity', v_before,
    'after_quantity', v_after,
    'quantity_added', p_quantity_to_add,
    'action', 'restock',
    'idempotency_key', v_key
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.usage_logs
    where idempotency_key = v_key
    limit 1;

    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'quantity_added', abs(v_existing.quantity_used),
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
end;
$$;

create or replace function public.rpc_adjust_item_stock(
  p_item_id uuid,
  p_new_quantity numeric,
  p_used_by_name text default null,
  p_used_by_id uuid default null,
  p_notes text default '',
  p_source text default 'manual',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_existing public.usage_logs%rowtype;
  v_before numeric;
  v_after numeric;
  v_delta numeric;
  v_key text;
begin
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  v_key := coalesce(nullif(p_idempotency_key, ''), gen_random_uuid()::text);

  select *
  into v_existing
  from public.usage_logs
  where idempotency_key = v_key
  limit 1;

  if found then
    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'quantity_delta', v_existing.after_quantity - v_existing.before_quantity,
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
  end if;

  select *
  into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  v_before := v_item.quantity;
  v_after := p_new_quantity;
  v_delta := v_after - v_before;

  insert into public.usage_logs (
    item_id,
    item_name,
    item_type,
    quantity_used,
    unit,
    used_by_name,
    used_by_id,
    notes,
    before_quantity,
    after_quantity,
    action,
    source,
    idempotency_key
  )
  values (
    v_item.id,
    v_item.name,
    v_item.category,
    -v_delta,
    v_item.unit,
    coalesce(p_used_by_name, 'User'),
    p_used_by_id,
    coalesce(p_notes, ''),
    v_before,
    v_after,
    'adjust',
    coalesce(p_source, 'manual'),
    v_key
  );

  update public.items
  set quantity = v_after
  where id = v_item.id;

  return jsonb_build_object(
    'item_id', v_item.id,
    'before_quantity', v_before,
    'after_quantity', v_after,
    'quantity_delta', v_delta,
    'action', 'adjust',
    'idempotency_key', v_key
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.usage_logs
    where idempotency_key = v_key
    limit 1;

    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'quantity_delta', v_existing.after_quantity - v_existing.before_quantity,
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
end;
$$;

create or replace function public.rpc_dispose_item(
  p_item_id uuid,
  p_used_by_name text default null,
  p_used_by_id uuid default null,
  p_reason text default '',
  p_notes text default '',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_existing public.usage_logs%rowtype;
  v_before numeric;
  v_after numeric := 0;
  v_key text;
  v_combined_notes text;
begin
  v_key := coalesce(nullif(p_idempotency_key, ''), gen_random_uuid()::text);

  select *
  into v_existing
  from public.usage_logs
  where idempotency_key = v_key
  limit 1;

  if found then
    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
  end if;

  select *
  into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  if v_item.status = 'disposed' then
    raise exception 'Item is already disposed';
  end if;

  v_before := v_item.quantity;
  v_combined_notes := case
    when coalesce(trim(p_notes), '') = '' then coalesce(p_reason, '')
    when coalesce(trim(p_reason), '') = '' then trim(p_notes)
    else trim(p_reason) || ' - ' || trim(p_notes)
  end;

  insert into public.usage_logs (
    item_id,
    item_name,
    item_type,
    quantity_used,
    unit,
    used_by_name,
    used_by_id,
    notes,
    before_quantity,
    after_quantity,
    action,
    source,
    idempotency_key
  )
  values (
    v_item.id,
    v_item.name,
    v_item.category,
    v_before,
    v_item.unit,
    coalesce(p_used_by_name, 'User'),
    p_used_by_id,
    v_combined_notes,
    v_before,
    v_after,
    'dispose',
    'manual',
    v_key
  );

  update public.items
  set
    quantity = 0,
    status = 'disposed',
    disposed_at = timezone('utc', now()),
    disposed_reason = coalesce(p_reason, ''),
    disposed_by_id = p_used_by_id
  where id = v_item.id;

  return jsonb_build_object(
    'item_id', v_item.id,
    'before_quantity', v_before,
    'after_quantity', 0,
    'action', 'dispose',
    'idempotency_key', v_key
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.usage_logs
    where idempotency_key = v_key
    limit 1;

    return jsonb_build_object(
      'item_id', v_existing.item_id,
      'before_quantity', v_existing.before_quantity,
      'after_quantity', v_existing.after_quantity,
      'action', v_existing.action,
      'idempotency_key', v_existing.idempotency_key,
      'usage_log_id', v_existing.id
    );
end;
$$;

revoke all on function public.rpc_safe_use_item(uuid, numeric, text, uuid, text, text, text, text, text) from public;
revoke all on function public.rpc_restock_item(uuid, numeric, text, uuid, text, text, text) from public;
revoke all on function public.rpc_adjust_item_stock(uuid, numeric, text, uuid, text, text, text) from public;
revoke all on function public.rpc_dispose_item(uuid, text, uuid, text, text, text) from public;

grant execute on function public.rpc_safe_use_item(uuid, numeric, text, uuid, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.rpc_restock_item(uuid, numeric, text, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.rpc_adjust_item_stock(uuid, numeric, text, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.rpc_dispose_item(uuid, text, uuid, text, text, text) to authenticated, service_role;
