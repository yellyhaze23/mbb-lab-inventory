-- Allow permanent item deletion while preserving usage history.
-- Existing usage_logs rows keep item_name/item_type snapshots.

alter table public.usage_logs
  drop constraint if exists usage_logs_item_id_fkey;

alter table public.usage_logs
  alter column item_id drop not null;

alter table public.usage_logs
  add constraint usage_logs_item_id_fkey
  foreign key (item_id)
  references public.items(id)
  on delete set null;
