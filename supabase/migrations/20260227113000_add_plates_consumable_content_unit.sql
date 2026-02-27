do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'items_pack_category_content_unit_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      drop constraint items_pack_category_content_unit_check;
  end if;

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
        and content_unit in ('pcs', 'pieces', 'tubes', 'vials', 'strips', 'sachets', 'preps', 'plates')
      )
    );
end $$;
