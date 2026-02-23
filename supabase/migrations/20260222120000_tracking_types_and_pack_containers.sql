create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- Items: additive tracking model
-- -------------------------------------------------------------------
alter table public.items
  add column if not exists tracking_type text,
  add column if not exists quantity_value numeric,
  add column if not exists quantity_unit text,
  add column if not exists unit_type text,
  add column if not exists total_units integer,
  add column if not exists content_per_unit integer,
  add column if not exists content_label text,
  add column if not exists total_content integer;

update public.items
set quantity_value = coalesce(quantity_value, quantity)
where quantity_value is null;

update public.items
set quantity_unit = coalesce(quantity_unit, unit)
where quantity_unit is null and coalesce(unit, '') <> '';

update public.items
set total_units = coalesce(total_units, greatest(floor(coalesce(quantity, 0)), 0)::int)
where total_units is null;

update public.items
set unit_type = coalesce(unit_type, nullif(unit, ''))
where unit_type is null and coalesce(unit, '') <> '';

update public.items
set content_label = coalesce(nullif(content_label, ''), 'pcs')
where content_label is null;

update public.items
set tracking_type = case
  when tracking_type is not null then tracking_type
  when coalesce(quantity_unit, unit) in ('g', 'mg', 'kg', 'mL', 'ml', 'L', 'l', 'uL', 'ul', 'µL', 'ug', 'µg', 'mol', 'mmol')
    then 'SIMPLE_MEASURE'
  else 'UNIT_ONLY'
end
where tracking_type is null;

update public.items
set total_content = coalesce(total_content, coalesce(total_units, 0) * coalesce(content_per_unit, 0))
where tracking_type = 'PACK_WITH_CONTENT'
  and total_content is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'items_tracking_type_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_tracking_type_check
      check (tracking_type in ('SIMPLE_MEASURE', 'UNIT_ONLY', 'PACK_WITH_CONTENT'));
  end if;
end $$;

alter table public.items
  alter column tracking_type set default 'SIMPLE_MEASURE',
  alter column tracking_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'items_tracking_shape_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_tracking_shape_check
      check (
        (tracking_type = 'SIMPLE_MEASURE' and quantity_value is not null and quantity_value >= 0 and coalesce(quantity_unit, '') <> '')
        or
        (tracking_type = 'UNIT_ONLY' and total_units is not null and total_units >= 0 and coalesce(unit_type, '') <> '')
        or
        (
          tracking_type = 'PACK_WITH_CONTENT'
          and total_units is not null and total_units >= 0
          and coalesce(unit_type, '') <> ''
          and content_per_unit is not null and content_per_unit > 0
          and coalesce(content_label, '') <> ''
          and total_content is not null and total_content >= 0
          and total_content <= (total_units * content_per_unit)
        )
      );
  end if;
end $$;

create or replace function public.sync_item_tracking_fields()
returns trigger
language plpgsql
as $$
begin
  if new.tracking_type = 'SIMPLE_MEASURE' then
    new.quantity_value := coalesce(new.quantity_value, 0);
    new.quantity_unit := coalesce(nullif(new.quantity_unit, ''), nullif(new.unit, ''), 'unit');
    new.quantity := new.quantity_value;
    new.unit := new.quantity_unit;
  elsif new.tracking_type = 'UNIT_ONLY' then
    new.total_units := coalesce(new.total_units, 0);
    new.unit_type := coalesce(nullif(new.unit_type, ''), nullif(new.unit, ''), 'unit');
    new.quantity := new.total_units;
    new.unit := new.unit_type;
  elsif new.tracking_type = 'PACK_WITH_CONTENT' then
    new.total_units := coalesce(new.total_units, 0);
    new.unit_type := coalesce(nullif(new.unit_type, ''), nullif(new.unit, ''), 'pack');
    new.content_label := coalesce(nullif(new.content_label, ''), 'pcs');
    new.total_content := coalesce(new.total_content, 0);
    new.quantity := new.total_units;
    new.unit := new.unit_type;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_items_sync_tracking_fields on public.items;
create trigger trg_items_sync_tracking_fields
before insert or update on public.items
for each row
execute function public.sync_item_tracking_fields();

-- -------------------------------------------------------------------
-- PACK containers (SEALED/OPENED)
-- -------------------------------------------------------------------
create table if not exists public.item_containers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  status text not null check (status in ('SEALED', 'OPENED')),
  sealed_count integer,
  opened_content_remaining integer,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (status = 'SEALED' and sealed_count is not null and sealed_count >= 0 and opened_content_remaining is null)
    or
    (status = 'OPENED' and opened_content_remaining is not null and opened_content_remaining >= 0 and sealed_count is null)
  )
);

create unique index if not exists uq_item_containers_sealed_per_item
  on public.item_containers(item_id)
  where status = 'SEALED';

create index if not exists idx_item_containers_item_id on public.item_containers(item_id);
create index if not exists idx_item_containers_status on public.item_containers(status);
create index if not exists idx_item_containers_created_at on public.item_containers(created_at);
create index if not exists idx_item_containers_item_status_created on public.item_containers(item_id, status, created_at);

alter table public.item_containers enable row level security;

drop policy if exists item_containers_select_authenticated_active on public.item_containers;
create policy item_containers_select_authenticated_active
on public.item_containers
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists item_containers_mutate_admin on public.item_containers;
create policy item_containers_mutate_admin
on public.item_containers
for all
to authenticated
using (public.is_admin_or_super_admin())
with check (public.is_admin_or_super_admin());

-- -------------------------------------------------------------------
-- Transactions ledger
-- -------------------------------------------------------------------
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  action text not null check (action in ('ADD', 'USE_DEDUCT', 'RESTOCK', 'ADJUST', 'DISPOSE', 'ARCHIVE')),
  delta_measure numeric,
  measure_unit text,
  delta_units integer,
  delta_content integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid references public.profiles(id) on delete set null
);

create index if not exists idx_inventory_transactions_item_id on public.inventory_transactions(item_id);
create index if not exists idx_inventory_transactions_action on public.inventory_transactions(action);
create index if not exists idx_inventory_transactions_created_at_desc on public.inventory_transactions(created_at desc);

alter table public.inventory_transactions enable row level security;

drop policy if exists inventory_transactions_select_authenticated_active on public.inventory_transactions;
create policy inventory_transactions_select_authenticated_active
on public.inventory_transactions
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists inventory_transactions_insert_admin on public.inventory_transactions;
create policy inventory_transactions_insert_admin
on public.inventory_transactions
for insert
to authenticated
with check (public.is_admin_or_super_admin());

drop policy if exists inventory_transactions_update_delete_super_admin on public.inventory_transactions;
create policy inventory_transactions_update_delete_super_admin
on public.inventory_transactions
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create or replace function public.log_inventory_add_transaction()
returns trigger
language plpgsql
as $$
begin
  insert into public.inventory_transactions (
    item_id,
    action,
    delta_measure,
    measure_unit,
    delta_units,
    delta_content,
    notes,
    user_id
  )
  values (
    new.id,
    'ADD',
    case when new.tracking_type = 'SIMPLE_MEASURE' then new.quantity_value else null end,
    case when new.tracking_type = 'SIMPLE_MEASURE' then new.quantity_unit else null end,
    case when new.tracking_type in ('UNIT_ONLY', 'PACK_WITH_CONTENT') then new.total_units else null end,
    case when new.tracking_type = 'PACK_WITH_CONTENT' then new.total_content else null end,
    'Initial stock',
    coalesce(new.created_by_id, auth.uid())
  );
  return new;
end;
$$;

drop trigger if exists trg_items_log_add_transaction on public.items;
create trigger trg_items_log_add_transaction
after insert on public.items
for each row
execute function public.log_inventory_add_transaction();

-- -------------------------------------------------------------------
-- Tracking-aware RPCs
-- -------------------------------------------------------------------
create or replace function public.use_deduct_item(
  p_item_id uuid,
  p_mode text,
  p_amount numeric,
  p_notes text default '',
  p_used_by_name text default null,
  p_used_by_id uuid default null,
  p_source text default 'manual',
  p_student_id text default null,
  p_experiment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_mode text := upper(coalesce(p_mode, ''));
  v_source text := coalesce(nullif(p_source, ''), 'manual');
  v_actor_name text := coalesce(nullif(p_used_by_name, ''), (select full_name from public.profiles where id = auth.uid()), 'User');
  v_actor_id uuid := coalesce(p_used_by_id, auth.uid());
  v_sealed public.item_containers%rowtype;
  v_opened public.item_containers%rowtype;
  v_opened_count integer := 0;
  v_sealed_count integer := 0;
  v_remaining integer := 0;
  v_take integer := 0;
  v_amount_int integer := 0;
  v_units_fully_consumed integer := 0;
  v_before_qty numeric := 0;
  v_after_qty numeric := 0;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
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

  if v_item.tracking_type = 'SIMPLE_MEASURE' then
    if p_amount > v_item.quantity_value then
      raise exception 'Insufficient stock. Available: % %', v_item.quantity_value, v_item.quantity_unit;
    end if;

    v_before_qty := v_item.quantity_value;

    update public.items
    set quantity_value = quantity_value - p_amount
    where id = v_item.id
    returning quantity_value into v_after_qty;

    insert into public.inventory_transactions (
      item_id, action, delta_measure, measure_unit, notes, user_id
    )
    values (
      v_item.id, 'USE_DEDUCT', -p_amount, v_item.quantity_unit, coalesce(p_notes, ''), v_actor_id
    );

    insert into public.usage_logs (
      item_id, item_name, item_type, quantity_used, unit,
      used_by_name, used_by_id, notes, before_quantity, after_quantity, action, source, idempotency_key, student_id, experiment
    )
    values (
      v_item.id, v_item.name, v_item.category, p_amount, v_item.quantity_unit,
      v_actor_name, v_actor_id,
      coalesce(p_notes, ''), v_before_qty, v_after_qty,
      'use', v_source, gen_random_uuid()::text, p_student_id, p_experiment
    );

    return jsonb_build_object(
      'item_id', v_item.id,
      'tracking_type', v_item.tracking_type,
      'sealed_count', null,
      'opened_count', null,
      'total_units', null,
      'total_content', null,
      'quantity_value', v_after_qty,
      'quantity_unit', v_item.quantity_unit
    );
  end if;

  if v_item.tracking_type = 'UNIT_ONLY' then
    if p_amount <> floor(p_amount) then
      raise exception 'UNIT_ONLY deduction requires whole units';
    end if;
    v_amount_int := p_amount::int;

    if v_amount_int > v_item.total_units then
      raise exception 'Insufficient stock. Available: % %', v_item.total_units, v_item.unit_type;
    end if;

    v_before_qty := v_item.total_units;

    update public.items
    set total_units = total_units - v_amount_int
    where id = v_item.id
    returning total_units into v_after_qty;

    insert into public.inventory_transactions (
      item_id, action, delta_units, notes, user_id
    )
    values (
      v_item.id, 'USE_DEDUCT', -v_amount_int, coalesce(p_notes, ''), v_actor_id
    );

    insert into public.usage_logs (
      item_id, item_name, item_type, quantity_used, unit,
      used_by_name, used_by_id, notes, before_quantity, after_quantity, action, source, idempotency_key, student_id, experiment
    )
    values (
      v_item.id, v_item.name, v_item.category, v_amount_int, v_item.unit_type,
      v_actor_name, v_actor_id,
      coalesce(p_notes, ''), v_before_qty, v_after_qty,
      'use', v_source, gen_random_uuid()::text, p_student_id, p_experiment
    );

    return jsonb_build_object(
      'item_id', v_item.id,
      'tracking_type', v_item.tracking_type,
      'sealed_count', null,
      'opened_count', null,
      'total_units', v_after_qty,
      'total_content', null
    );
  end if;

  if v_item.content_per_unit is null or v_item.content_per_unit <= 0 then
    raise exception 'PACK_WITH_CONTENT item must define content_per_unit';
  end if;

  if v_mode not in ('CONTENT', 'UNITS') then
    raise exception 'Invalid mode. Use CONTENT or UNITS';
  end if;

  select *
  into v_sealed
  from public.item_containers
  where item_id = v_item.id and status = 'SEALED'
  for update;

  if not found then
    insert into public.item_containers (item_id, status, sealed_count)
    values (v_item.id, 'SEALED', 0)
    returning * into v_sealed;
  end if;

  v_sealed_count := coalesce(v_sealed.sealed_count, 0);

  if v_mode = 'UNITS' then
    if p_amount <> floor(p_amount) then
      raise exception 'Units mode requires a whole number';
    end if;
    v_amount_int := p_amount::int;

    if v_amount_int > v_sealed_count then
      raise exception 'Insufficient sealed packs. Available sealed: % %', v_sealed_count, v_item.unit_type;
    end if;

    update public.item_containers
    set sealed_count = sealed_count - v_amount_int
    where id = v_sealed.id
    returning sealed_count into v_sealed_count;

    update public.items
    set
      total_units = total_units - v_amount_int,
      total_content = total_content - (v_amount_int * content_per_unit)
    where id = v_item.id
    returning total_units, total_content into v_after_qty, v_remaining;

    select count(*)
    into v_opened_count
    from public.item_containers
    where item_id = v_item.id and status = 'OPENED';

    insert into public.inventory_transactions (
      item_id, action, delta_units, delta_content, notes, user_id
    )
    values (
      v_item.id, 'USE_DEDUCT', -v_amount_int, -(v_amount_int * v_item.content_per_unit), coalesce(p_notes, ''), v_actor_id
    );

    insert into public.usage_logs (
      item_id, item_name, item_type, quantity_used, unit,
      used_by_name, used_by_id, notes, before_quantity, after_quantity, action, source, idempotency_key, student_id, experiment
    )
    values (
      v_item.id, v_item.name, v_item.category, v_amount_int, v_item.unit_type,
      v_actor_name, v_actor_id,
      coalesce(p_notes, ''), v_item.total_units, v_after_qty,
      'use', v_source, gen_random_uuid()::text, p_student_id, p_experiment
    );

    return jsonb_build_object(
      'item_id', v_item.id,
      'tracking_type', v_item.tracking_type,
      'sealed_count', v_sealed_count,
      'opened_count', v_opened_count,
      'total_units', v_after_qty,
      'total_content', v_remaining
    );
  end if;

  if p_amount <> floor(p_amount) then
    raise exception 'Content mode requires a whole number';
  end if;
  v_amount_int := p_amount::int;

  if v_amount_int > v_item.total_content then
    raise exception 'Insufficient stock. Available: % %', v_item.total_content, v_item.content_label;
  end if;

  v_remaining := v_amount_int;

  for v_opened in
    select *
    from public.item_containers
    where item_id = v_item.id and status = 'OPENED'
    order by created_at, id
    for update
  loop
    exit when v_remaining <= 0;

    v_take := least(v_remaining, v_opened.opened_content_remaining);
    v_remaining := v_remaining - v_take;

    update public.item_containers
    set opened_content_remaining = opened_content_remaining - v_take
    where id = v_opened.id
    returning opened_content_remaining into v_take;

    if v_take <= 0 then
      delete from public.item_containers where id = v_opened.id;
      v_units_fully_consumed := v_units_fully_consumed + 1;
    end if;
  end loop;

  while v_remaining > 0 loop
    if v_sealed_count <= 0 then
      raise exception 'Insufficient stock while opening sealed packs';
    end if;

    v_sealed_count := v_sealed_count - 1;
    update public.item_containers
    set sealed_count = v_sealed_count
    where id = v_sealed.id;

    insert into public.item_containers (item_id, status, opened_content_remaining)
    values (v_item.id, 'OPENED', v_item.content_per_unit)
    returning * into v_opened;

    v_take := least(v_remaining, v_opened.opened_content_remaining);
    v_remaining := v_remaining - v_take;

    update public.item_containers
    set opened_content_remaining = opened_content_remaining - v_take
    where id = v_opened.id
    returning opened_content_remaining into v_take;

    if v_take <= 0 then
      delete from public.item_containers where id = v_opened.id;
      v_units_fully_consumed := v_units_fully_consumed + 1;
    end if;
  end loop;

  update public.items
  set
    total_content = total_content - v_amount_int,
    total_units = total_units - v_units_fully_consumed
  where id = v_item.id
  returning total_units, total_content into v_after_qty, v_remaining;

  select count(*)
  into v_opened_count
  from public.item_containers
  where item_id = v_item.id and status = 'OPENED';

  insert into public.inventory_transactions (
    item_id, action, delta_content, notes, user_id
  )
  values (
    v_item.id, 'USE_DEDUCT', -v_amount_int, coalesce(p_notes, ''), v_actor_id
  );

  insert into public.usage_logs (
    item_id, item_name, item_type, quantity_used, unit,
    used_by_name, used_by_id, notes, before_quantity, after_quantity, action, source, idempotency_key, student_id, experiment
  )
  values (
    v_item.id, v_item.name, v_item.category, v_amount_int, v_item.content_label,
    v_actor_name, v_actor_id,
    coalesce(p_notes, ''), v_item.total_content, v_remaining,
    'use', v_source, gen_random_uuid()::text, p_student_id, p_experiment
  );

  return jsonb_build_object(
    'item_id', v_item.id,
    'tracking_type', v_item.tracking_type,
    'sealed_count', v_sealed_count,
    'opened_count', v_opened_count,
    'total_units', v_after_qty,
    'total_content', v_remaining
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
  v_key text;
  v_before numeric;
  v_after numeric;
  v_units integer;
  v_sealed public.item_containers%rowtype;
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

  if v_item.tracking_type = 'SIMPLE_MEASURE' then
    v_before := v_item.quantity_value;

    update public.items
    set quantity_value = quantity_value + p_quantity_to_add
    where id = v_item.id
    returning quantity_value into v_after;

    insert into public.inventory_transactions (
      item_id, action, delta_measure, measure_unit, notes, user_id
    )
    values (
      v_item.id, 'RESTOCK', p_quantity_to_add, v_item.quantity_unit, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid())
    );
  elsif v_item.tracking_type = 'UNIT_ONLY' then
    if p_quantity_to_add <> floor(p_quantity_to_add) then
      raise exception 'UNIT_ONLY restock must be a whole number of units';
    end if;

    v_units := p_quantity_to_add::int;
    v_before := v_item.total_units;

    update public.items
    set total_units = total_units + v_units
    where id = v_item.id
    returning total_units into v_after;

    insert into public.inventory_transactions (
      item_id, action, delta_units, notes, user_id
    )
    values (
      v_item.id, 'RESTOCK', v_units, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid())
    );
  else
    if p_quantity_to_add <> floor(p_quantity_to_add) then
      raise exception 'PACK_WITH_CONTENT restock must be a whole number of units';
    end if;

    v_units := p_quantity_to_add::int;
    v_before := v_item.total_units;

    select *
    into v_sealed
    from public.item_containers
    where item_id = v_item.id and status = 'SEALED'
    for update;

    if not found then
      insert into public.item_containers (item_id, status, sealed_count)
      values (v_item.id, 'SEALED', 0)
      returning * into v_sealed;
    end if;

    update public.item_containers
    set sealed_count = sealed_count + v_units
    where id = v_sealed.id;

    update public.items
    set
      total_units = total_units + v_units,
      total_content = total_content + (v_units * content_per_unit)
    where id = v_item.id
    returning total_units into v_after;

    insert into public.inventory_transactions (
      item_id, action, delta_units, delta_content, notes, user_id
    )
    values (
      v_item.id, 'RESTOCK', v_units, v_units * v_item.content_per_unit, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid())
    );
  end if;

  insert into public.usage_logs (
    item_id, item_name, item_type, quantity_used, unit, used_by_name, used_by_id,
    notes, before_quantity, after_quantity, action, source, idempotency_key
  )
  values (
    v_item.id, v_item.name, v_item.category, -p_quantity_to_add,
    case
      when v_item.tracking_type = 'SIMPLE_MEASURE' then v_item.quantity_unit
      else v_item.unit_type
    end,
    coalesce(p_used_by_name, 'User'), p_used_by_id,
    coalesce(p_notes, ''), v_before, v_after, 'restock', coalesce(p_source, 'manual'), v_key
  );

  return jsonb_build_object(
    'item_id', v_item.id,
    'before_quantity', v_before,
    'after_quantity', v_after,
    'quantity_added', p_quantity_to_add,
    'action', 'restock',
    'idempotency_key', v_key
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
  v_key text;
  v_before numeric;
  v_after numeric;
  v_delta numeric;
  v_units integer;
  v_opened_count integer := 0;
  v_opened_content integer := 0;
  v_sealed public.item_containers%rowtype;
  v_new_total_content integer := 0;
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

  if v_item.tracking_type = 'SIMPLE_MEASURE' then
    v_before := v_item.quantity_value;
    v_after := p_new_quantity;
    v_delta := v_after - v_before;

    update public.items
    set quantity_value = p_new_quantity
    where id = v_item.id;

    insert into public.inventory_transactions (
      item_id, action, delta_measure, measure_unit, notes, user_id
    )
    values (
      v_item.id, 'ADJUST', v_delta, v_item.quantity_unit, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid())
    );
  elsif v_item.tracking_type = 'UNIT_ONLY' then
    if p_new_quantity <> floor(p_new_quantity) then
      raise exception 'UNIT_ONLY adjust requires whole units';
    end if;

    v_before := v_item.total_units;
    v_after := p_new_quantity;
    v_delta := v_after - v_before;

    update public.items
    set total_units = p_new_quantity::int
    where id = v_item.id;

    insert into public.inventory_transactions (
      item_id, action, delta_units, notes, user_id
    )
    values (
      v_item.id, 'ADJUST', v_delta::int, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid())
    );
  else
    if p_new_quantity <> floor(p_new_quantity) then
      raise exception 'PACK_WITH_CONTENT adjust requires whole units';
    end if;

    v_units := p_new_quantity::int;
    v_before := v_item.total_units;
    v_after := v_units;
    v_delta := v_after - v_before;

    select *
    into v_sealed
    from public.item_containers
    where item_id = v_item.id and status = 'SEALED'
    for update;

    if not found then
      insert into public.item_containers (item_id, status, sealed_count)
      values (v_item.id, 'SEALED', 0)
      returning * into v_sealed;
    end if;

    perform 1
    from public.item_containers
    where item_id = v_item.id and status = 'OPENED'
    for update;

    select
      count(*),
      coalesce(sum(opened_content_remaining), 0)
    into v_opened_count, v_opened_content
    from public.item_containers
    where item_id = v_item.id and status = 'OPENED';

    if v_units < v_opened_count then
      raise exception 'Cannot set total units below opened pack count (%)', v_opened_count;
    end if;

    update public.item_containers
    set sealed_count = v_units - v_opened_count
    where id = v_sealed.id;

    v_new_total_content := (v_units - v_opened_count) * v_item.content_per_unit + v_opened_content;

    update public.items
    set
      total_units = v_units,
      total_content = v_new_total_content
    where id = v_item.id;

    insert into public.inventory_transactions (
      item_id, action, delta_units, delta_content, notes, user_id
    )
    values (
      v_item.id,
      'ADJUST',
      (v_after - v_before)::int,
      (v_new_total_content - v_item.total_content),
      coalesce(p_notes, ''),
      coalesce(p_used_by_id, auth.uid())
    );
  end if;

  insert into public.usage_logs (
    item_id, item_name, item_type, quantity_used, unit, used_by_name, used_by_id,
    notes, before_quantity, after_quantity, action, source, idempotency_key
  )
  values (
    v_item.id, v_item.name, v_item.category, -v_delta,
    case
      when v_item.tracking_type = 'SIMPLE_MEASURE' then v_item.quantity_unit
      else v_item.unit_type
    end,
    coalesce(p_used_by_name, 'User'), p_used_by_id,
    coalesce(p_notes, ''), v_before, v_after, 'adjust', coalesce(p_source, 'manual'), v_key
  );

  return jsonb_build_object(
    'item_id', v_item.id,
    'before_quantity', v_before,
    'after_quantity', v_after,
    'quantity_delta', v_delta,
    'action', 'adjust',
    'idempotency_key', v_key
  );
end;
$$;

revoke all on function public.use_deduct_item(uuid, text, numeric, text, text, uuid, text, text, text) from public;
grant execute on function public.use_deduct_item(uuid, text, numeric, text, text, uuid, text, text, text) to authenticated, service_role;
