create extension if not exists pgcrypto;

alter table public.items
  add column if not exists content_unit text,
  add column if not exists total_content_unit text,
  add column if not exists opened_units integer not null default 0,
  add column if not exists sealed_units integer not null default 0,
  add column if not exists status_summary text,
  add column if not exists needs_measurement_data boolean not null default false;

update public.items
set content_unit = coalesce(nullif(content_unit, ''), nullif(total_content_unit, ''), nullif(content_label, ''), nullif(quantity_unit, ''), nullif(unit, ''), 'pcs')
where content_unit is null or content_unit = '';

update public.items
set total_content_unit = coalesce(nullif(total_content_unit, ''), nullif(content_unit, ''), nullif(content_label, ''), 'pcs')
where total_content_unit is null or total_content_unit = '';

update public.items
set content_label = content_unit
where coalesce(content_label, '') = '';

update public.items
set needs_measurement_data = true
where tracking_type = 'PACK_WITH_CONTENT'
  and (
    coalesce(total_units, 0) < 1
    or coalesce(content_per_unit, 0) <= 0
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_pack_category_content_unit_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_pack_category_content_unit_check
      check (
        tracking_type <> 'PACK_WITH_CONTENT'
        or (
          category = 'chemical'
          and content_unit in ('mg', 'g', 'kg', 'uL', 'µL', 'mL', 'L')
        )
        or (
          category = 'consumable'
          and content_unit in ('pcs', 'pieces', 'tubes', 'vials', 'strips', 'sachets', 'preps')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_pack_positive_quantities_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_pack_positive_quantities_check
      check (
        tracking_type <> 'PACK_WITH_CONTENT'
        or (coalesce(total_units, 0) >= 1 and coalesce(content_per_unit, 0) > 0)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'item_containers_legacy_20260225'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'item_containers'
      and column_name = 'sealed_count'
  ) then
    alter table public.item_containers rename to item_containers_legacy_20260225;
  end if;
end $$;

create table if not exists public.item_containers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  container_index integer not null,
  status text not null check (status in ('sealed', 'opened', 'empty')),
  initial_content numeric not null check (initial_content > 0),
  remaining_content numeric not null check (remaining_content >= 0),
  content_unit text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(item_id, container_index)
);

create index if not exists idx_item_containers_item_id on public.item_containers(item_id);
create index if not exists idx_item_containers_item_status_idx on public.item_containers(item_id, status, container_index);

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

create or replace function public.recalculate_item_container_summary(p_item_id uuid)
returns void
language plpgsql
as $$
declare
  v_sealed integer := 0;
  v_opened integer := 0;
  v_empty integer := 0;
  v_total_units integer := 0;
  v_total_content numeric := 0;
  v_content_unit text;
begin
  select
    count(*) filter (where status = 'sealed'),
    count(*) filter (where status = 'opened'),
    count(*) filter (where status = 'empty'),
    count(*) filter (where status in ('sealed', 'opened')),
    coalesce(sum(remaining_content) filter (where status in ('sealed', 'opened')), 0),
    max(content_unit)
  into v_sealed, v_opened, v_empty, v_total_units, v_total_content, v_content_unit
  from public.item_containers
  where item_id = p_item_id;

  update public.items
  set
    total_units = v_total_units,
    quantity = v_total_units,
    total_content = v_total_content,
    content_unit = coalesce(v_content_unit, content_unit),
    total_content_unit = coalesce(v_content_unit, total_content_unit, content_unit),
    content_label = coalesce(v_content_unit, content_label),
    sealed_units = v_sealed,
    opened_units = v_opened,
    status_summary = concat('sealed:', v_sealed, ',opened:', v_opened, ',empty:', v_empty)
  where id = p_item_id;
end;
$$;

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
    new.content_unit := coalesce(nullif(new.content_unit, ''), nullif(new.total_content_unit, ''), nullif(new.content_label, ''), 'pcs');
    new.total_content_unit := new.content_unit;
    new.content_label := new.content_unit;
    new.total_content := coalesce(new.total_content, new.total_units * coalesce(new.content_per_unit, 0));
    new.quantity := new.total_units;
    new.unit := new.unit_type;
  end if;

  return new;
end;
$$;

create or replace function public.init_item_containers_from_item()
returns trigger
language plpgsql
as $$
declare
  v_opened_units integer := greatest(coalesce(new.opened_units, 0), 0);
begin
  if new.tracking_type <> 'PACK_WITH_CONTENT' then
    return new;
  end if;

  if coalesce(new.total_units, 0) < 1 or coalesce(new.content_per_unit, 0) <= 0 then
    update public.items
    set needs_measurement_data = true
    where id = new.id;
    return new;
  end if;

  if exists (select 1 from public.item_containers where item_id = new.id) then
    perform public.recalculate_item_container_summary(new.id);
    return new;
  end if;

  insert into public.item_containers (
    item_id,
    container_index,
    status,
    initial_content,
    remaining_content,
    content_unit
  )
  select
    new.id,
    g.idx,
    case when g.idx <= least(v_opened_units, new.total_units) then 'opened' else 'sealed' end,
    new.content_per_unit,
    new.content_per_unit,
    coalesce(new.content_unit, new.total_content_unit, new.content_label, 'pcs')
  from generate_series(1, new.total_units) as g(idx);

  perform public.recalculate_item_container_summary(new.id);

  return new;
end;
$$;

create or replace function public.trg_item_containers_recalc_item()
returns trigger
language plpgsql
as $$
begin
  perform public.recalculate_item_container_summary(coalesce(new.item_id, old.item_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_items_init_containers on public.items;
create trigger trg_items_init_containers
after insert on public.items
for each row
execute function public.init_item_containers_from_item();

drop trigger if exists trg_item_containers_recalc_item on public.item_containers;
create trigger trg_item_containers_recalc_item
after insert or update or delete on public.item_containers
for each row
execute function public.trg_item_containers_recalc_item();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'item_containers_legacy_20260225'
  ) and not exists (
    select 1 from public.item_containers limit 1
  ) then
    with opened as (
      select
        item_id,
        row_number() over (partition by item_id order by created_at, id) as rn,
        opened_content_remaining
      from public.item_containers_legacy_20260225
      where upper(status) = 'OPENED'
    ),
    legacy_stats as (
      select
        i.id as item_id,
        i.total_units,
        i.content_per_unit,
        coalesce(i.content_unit, i.total_content_unit, i.content_label, 'pcs') as content_unit,
        coalesce(
          max(case when upper(l.status) = 'SEALED' then l.sealed_count end),
          0
        ) as sealed_from_legacy,
        count(*) filter (where upper(l.status) = 'OPENED') as opened_from_legacy
      from public.items i
      left join public.item_containers_legacy_20260225 l on l.item_id = i.id
      where i.tracking_type = 'PACK_WITH_CONTENT'
      group by i.id, i.total_units, i.content_per_unit, i.content_unit, i.total_content_unit, i.content_label
    ),
    seed as (
      select
        s.item_id,
        greatest(coalesce(s.total_units, 0), coalesce(s.sealed_from_legacy, 0) + coalesce(s.opened_from_legacy, 0)) as container_total,
        least(coalesce(s.opened_from_legacy, 0), greatest(coalesce(s.total_units, 0), coalesce(s.sealed_from_legacy, 0) + coalesce(s.opened_from_legacy, 0))) as opened_count,
        s.content_per_unit,
        s.content_unit
      from legacy_stats s
      where coalesce(s.total_units, 0) > 0
        and coalesce(s.content_per_unit, 0) > 0
    )
    insert into public.item_containers (
      item_id, container_index, status, initial_content, remaining_content, content_unit
    )
    select
      seed.item_id,
      g.idx,
      case when g.idx <= seed.opened_count then 'opened' else 'sealed' end,
      seed.content_per_unit,
      case
        when g.idx <= seed.opened_count then coalesce(
          (select o.opened_content_remaining from opened o where o.item_id = seed.item_id and o.rn = g.idx),
          seed.content_per_unit
        )
        else seed.content_per_unit
      end,
      seed.content_unit
    from seed
    cross join lateral generate_series(1, seed.container_total) as g(idx);
  end if;
end $$;

insert into public.item_containers (
  item_id, container_index, status, initial_content, remaining_content, content_unit
)
select
  i.id,
  g.idx,
  'sealed',
  i.content_per_unit,
  i.content_per_unit,
  coalesce(i.content_unit, i.total_content_unit, i.content_label, 'pcs')
from public.items i
cross join lateral generate_series(1, i.total_units) as g(idx)
where i.tracking_type = 'PACK_WITH_CONTENT'
  and coalesce(i.total_units, 0) > 0
  and coalesce(i.content_per_unit, 0) > 0
  and not exists (select 1 from public.item_containers c where c.item_id = i.id);

update public.items
set needs_measurement_data = true
where tracking_type = 'PACK_WITH_CONTENT'
  and not exists (select 1 from public.item_containers c where c.item_id = items.id);

with pack_ids as (
  select id from public.items where tracking_type = 'PACK_WITH_CONTENT'
)
select public.recalculate_item_container_summary(id)
from pack_ids;

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
  v_before_qty numeric := 0;
  v_after_qty numeric := 0;
  v_amount numeric := 0;
  v_opened_count integer := 0;
  v_sealed_count integer := 0;
  v_empty_count integer := 0;
  v_remaining numeric := 0;
  v_take numeric := 0;
  v_pack record;
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

    insert into public.inventory_transactions (item_id, action, delta_measure, measure_unit, notes, user_id)
    values (v_item.id, 'USE_DEDUCT', -p_amount, v_item.quantity_unit, coalesce(p_notes, ''), v_actor_id);

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
      'empty_count', null,
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
    if p_amount > v_item.total_units then
      raise exception 'Insufficient stock. Available: % %', v_item.total_units, v_item.unit_type;
    end if;

    v_before_qty := v_item.total_units;

    update public.items
    set total_units = total_units - p_amount::int
    where id = v_item.id
    returning total_units into v_after_qty;

    insert into public.inventory_transactions (item_id, action, delta_units, notes, user_id)
    values (v_item.id, 'USE_DEDUCT', -(p_amount::int), coalesce(p_notes, ''), v_actor_id);

    insert into public.usage_logs (
      item_id, item_name, item_type, quantity_used, unit,
      used_by_name, used_by_id, notes, before_quantity, after_quantity, action, source, idempotency_key, student_id, experiment
    )
    values (
      v_item.id, v_item.name, v_item.category, p_amount::int, v_item.unit_type,
      v_actor_name, v_actor_id,
      coalesce(p_notes, ''), v_before_qty, v_after_qty,
      'use', v_source, gen_random_uuid()::text, p_student_id, p_experiment
    );

    return jsonb_build_object(
      'item_id', v_item.id,
      'tracking_type', v_item.tracking_type,
      'sealed_count', null,
      'opened_count', null,
      'empty_count', null,
      'total_units', v_after_qty,
      'total_content', null
    );
  end if;

  if coalesce(v_item.content_per_unit, 0) <= 0 then
    raise exception 'PACK_WITH_CONTENT item must define content_per_unit';
  end if;

  if v_mode not in ('CONTENT', 'UNITS') then
    raise exception 'Invalid mode. Use CONTENT or UNITS';
  end if;

  if v_mode = 'UNITS' then
    if p_amount <> floor(p_amount) then
      raise exception 'Units mode requires a whole number';
    end if;

    select count(*) into v_sealed_count
    from public.item_containers
    where item_id = v_item.id and status = 'sealed';

    if p_amount::int > v_sealed_count then
      raise exception 'Insufficient sealed units. Available sealed: %', v_sealed_count;
    end if;

    v_before_qty := v_item.total_units;

    update public.item_containers
    set status = 'empty', remaining_content = 0
    where id in (
      select id
      from public.item_containers
      where item_id = v_item.id and status = 'sealed'
      order by container_index
      limit p_amount::int
      for update
    );

    perform public.recalculate_item_container_summary(v_item.id);

    select total_units, total_content into v_after_qty, v_remaining
    from public.items
    where id = v_item.id;

    select
      count(*) filter (where status = 'sealed'),
      count(*) filter (where status = 'opened'),
      count(*) filter (where status = 'empty')
    into v_sealed_count, v_opened_count, v_empty_count
    from public.item_containers
    where item_id = v_item.id;

    insert into public.inventory_transactions (item_id, action, delta_units, delta_content, notes, user_id)
    values (v_item.id, 'USE_DEDUCT', -(p_amount::int), -(p_amount::int * v_item.content_per_unit), coalesce(p_notes, ''), v_actor_id);

    insert into public.usage_logs (
      item_id, item_name, item_type, quantity_used, unit,
      used_by_name, used_by_id, notes, before_quantity, after_quantity, action, source, idempotency_key, student_id, experiment
    )
    values (
      v_item.id, v_item.name, v_item.category, p_amount::int, v_item.unit_type,
      v_actor_name, v_actor_id,
      coalesce(p_notes, ''), v_before_qty, v_after_qty,
      'use', v_source, gen_random_uuid()::text, p_student_id, p_experiment
    );

    return jsonb_build_object(
      'item_id', v_item.id,
      'tracking_type', v_item.tracking_type,
      'sealed_count', v_sealed_count,
      'opened_count', v_opened_count,
      'empty_count', v_empty_count,
      'total_units', v_after_qty,
      'total_content', v_remaining
    );
  end if;

  if p_amount > v_item.total_content then
    raise exception 'Insufficient stock. Available: % %', v_item.total_content, coalesce(v_item.content_unit, v_item.content_label);
  end if;

  v_before_qty := v_item.total_content;
  v_amount := p_amount;

  for v_pack in
    select id, remaining_content
    from public.item_containers
    where item_id = v_item.id and status = 'opened'
    order by container_index
    for update
  loop
    exit when v_amount <= 0;

    v_take := least(v_amount, v_pack.remaining_content);
    v_amount := v_amount - v_take;

    update public.item_containers
    set
      remaining_content = greatest(remaining_content - v_take, 0),
      status = case when remaining_content - v_take <= 0 then 'empty' else 'opened' end
    where id = v_pack.id;
  end loop;

  while v_amount > 0 loop
    select id
    into v_pack
    from public.item_containers
    where item_id = v_item.id and status = 'sealed'
    order by container_index
    limit 1
    for update;

    if not found then
      raise exception 'Insufficient stock while opening sealed containers';
    end if;

    update public.item_containers
    set status = 'opened'
    where id = v_pack.id;

    select id, remaining_content
    into v_pack
    from public.item_containers
    where id = v_pack.id
    for update;

    v_take := least(v_amount, v_pack.remaining_content);
    v_amount := v_amount - v_take;

    update public.item_containers
    set
      remaining_content = greatest(remaining_content - v_take, 0),
      status = case when remaining_content - v_take <= 0 then 'empty' else 'opened' end
    where id = v_pack.id;
  end loop;

  perform public.recalculate_item_container_summary(v_item.id);

  select total_content, total_units into v_after_qty, v_remaining
  from public.items
  where id = v_item.id;

  select
    count(*) filter (where status = 'sealed'),
    count(*) filter (where status = 'opened'),
    count(*) filter (where status = 'empty')
  into v_sealed_count, v_opened_count, v_empty_count
  from public.item_containers
  where item_id = v_item.id;

  insert into public.inventory_transactions (item_id, action, delta_content, notes, user_id)
  values (v_item.id, 'USE_DEDUCT', -p_amount, coalesce(p_notes, ''), v_actor_id);

  insert into public.usage_logs (
    item_id, item_name, item_type, quantity_used, unit,
    used_by_name, used_by_id, notes, before_quantity, after_quantity, action, source, idempotency_key, student_id, experiment
  )
  values (
    v_item.id, v_item.name, v_item.category, p_amount, coalesce(v_item.content_unit, v_item.content_label, 'pcs'),
    v_actor_name, v_actor_id,
    coalesce(p_notes, ''), v_before_qty, v_after_qty,
    'use', v_source, gen_random_uuid()::text, p_student_id, p_experiment
  );

  return jsonb_build_object(
    'item_id', v_item.id,
    'tracking_type', v_item.tracking_type,
    'sealed_count', v_sealed_count,
    'opened_count', v_opened_count,
    'empty_count', v_empty_count,
    'total_units', v_remaining,
    'total_content', v_after_qty
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
  v_next_idx integer;
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

    insert into public.inventory_transactions (item_id, action, delta_measure, measure_unit, notes, user_id)
    values (v_item.id, 'RESTOCK', p_quantity_to_add, v_item.quantity_unit, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid()));
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

    insert into public.inventory_transactions (item_id, action, delta_units, notes, user_id)
    values (v_item.id, 'RESTOCK', v_units, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid()));
  else
    if p_quantity_to_add <> floor(p_quantity_to_add) then
      raise exception 'PACK_WITH_CONTENT restock must be a whole number of units';
    end if;

    v_units := p_quantity_to_add::int;
    v_before := v_item.total_units;
    select coalesce(max(container_index), 0) + 1 into v_next_idx from public.item_containers where item_id = v_item.id;

    insert into public.item_containers (
      item_id, container_index, status, initial_content, remaining_content, content_unit
    )
    select
      v_item.id,
      v_next_idx + g.idx - 1,
      'sealed',
      v_item.content_per_unit,
      v_item.content_per_unit,
      coalesce(v_item.content_unit, v_item.content_label, 'pcs')
    from generate_series(1, v_units) as g(idx);

    perform public.recalculate_item_container_summary(v_item.id);

    select total_units into v_after from public.items where id = v_item.id;

    insert into public.inventory_transactions (item_id, action, delta_units, delta_content, notes, user_id)
    values (
      v_item.id,
      'RESTOCK',
      v_units,
      v_units * v_item.content_per_unit,
      coalesce(p_notes, ''),
      coalesce(p_used_by_id, auth.uid())
    );
  end if;

  insert into public.usage_logs (
    item_id, item_name, item_type, quantity_used, unit, used_by_name, used_by_id,
    notes, before_quantity, after_quantity, action, source, idempotency_key
  )
  values (
    v_item.id, v_item.name, v_item.category, -p_quantity_to_add,
    case when v_item.tracking_type = 'SIMPLE_MEASURE' then v_item.quantity_unit else v_item.unit_type end,
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
  v_sealed_count integer := 0;
  v_to_add integer := 0;
  v_to_remove integer := 0;
  v_next_idx integer := 0;
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

    insert into public.inventory_transactions (item_id, action, delta_measure, measure_unit, notes, user_id)
    values (v_item.id, 'ADJUST', v_delta, v_item.quantity_unit, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid()));
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

    insert into public.inventory_transactions (item_id, action, delta_units, notes, user_id)
    values (v_item.id, 'ADJUST', v_delta::int, coalesce(p_notes, ''), coalesce(p_used_by_id, auth.uid()));
  else
    if p_new_quantity <> floor(p_new_quantity) then
      raise exception 'PACK_WITH_CONTENT adjust requires whole units';
    end if;

    v_units := p_new_quantity::int;
    v_before := v_item.total_units;
    v_after := v_units;
    v_delta := v_after - v_before;

    select count(*) into v_opened_count
    from public.item_containers
    where item_id = v_item.id and status = 'opened';

    select count(*) into v_sealed_count
    from public.item_containers
    where item_id = v_item.id and status = 'sealed';

    if v_units < v_opened_count then
      raise exception 'Cannot set total units below opened container count (%)', v_opened_count;
    end if;

    if v_units > v_opened_count + v_sealed_count then
      v_to_add := v_units - (v_opened_count + v_sealed_count);
      select coalesce(max(container_index), 0) + 1 into v_next_idx
      from public.item_containers
      where item_id = v_item.id;

      insert into public.item_containers (
        item_id, container_index, status, initial_content, remaining_content, content_unit
      )
      select
        v_item.id,
        v_next_idx + g.idx - 1,
        'sealed',
        v_item.content_per_unit,
        v_item.content_per_unit,
        coalesce(v_item.content_unit, v_item.content_label, 'pcs')
      from generate_series(1, v_to_add) as g(idx);
    elsif v_units < v_opened_count + v_sealed_count then
      v_to_remove := (v_opened_count + v_sealed_count) - v_units;
      update public.item_containers
      set status = 'empty', remaining_content = 0
      where id in (
        select id
        from public.item_containers
        where item_id = v_item.id and status = 'sealed'
        order by container_index desc
        limit v_to_remove
      );
    end if;

    perform public.recalculate_item_container_summary(v_item.id);

    insert into public.inventory_transactions (
      item_id, action, delta_units, delta_content, notes, user_id
    )
    values (
      v_item.id,
      'ADJUST',
      (v_after - v_before)::int,
      (coalesce((select total_content from public.items where id = v_item.id), 0) - coalesce(v_item.total_content, 0)),
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
    case when v_item.tracking_type = 'SIMPLE_MEASURE' then v_item.quantity_unit else v_item.unit_type end,
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
