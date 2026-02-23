-- Allow permanent item deletion while preserving usage history.
-- Existing usage logs keep item_name/item_type snapshots; item_id is nulled on delete.

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'usage_logs'
      and constraint_name = 'usage_logs_item_id_fkey'
  ) then
    alter table public.usage_logs
      drop constraint usage_logs_item_id_fkey;
  end if;
end $$;

alter table public.usage_logs
  alter column item_id drop not null;

alter table public.usage_logs
  add constraint usage_logs_item_id_fkey
  foreign key (item_id)
  references public.items(id)
  on delete set null;
