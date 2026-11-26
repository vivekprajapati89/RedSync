-- RedSync Stage 4: Realtime Publication, Actor Enforcement, and Audit Trigger for blood_inventory

-- 1. Enable Realtime for public.blood_inventory (RLS still governs which rows clients receive)
alter table public.blood_inventory replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'blood_inventory'
  ) then
    alter publication supabase_realtime add table public.blood_inventory;
  end if;
end $$;

-- 2. Enforce updated_by = auth.uid() on client writes to blood_inventory
create or replace function public.enforce_blood_inventory_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_blood_inventory_actor on public.blood_inventory;
create trigger trg_enforce_blood_inventory_actor
  before insert or update on public.blood_inventory
  for each row execute function public.enforce_blood_inventory_actor();

-- 3. Audit trail for blood_inventory changes
create or replace function public.audit_blood_inventory_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (
      actor_id,
      actor_role,
      institution_id,
      entity_type,
      entity_id,
      action,
      after_data,
      is_demo
    )
    values (
      coalesce(auth.uid(), new.updated_by),
      coalesce(public.current_user_role(), current_user),
      new.institution_id,
      'blood_inventory',
      new.id,
      'inventory_created',
      jsonb_build_object(
        'blood_group', new.blood_group,
        'units', new.units,
        'min_threshold', new.min_threshold
      ),
      new.is_demo
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if new.units is distinct from old.units
       or new.min_threshold is distinct from old.min_threshold then
      insert into public.audit_logs (
        actor_id,
        actor_role,
        institution_id,
        entity_type,
        entity_id,
        action,
        before_data,
        after_data,
        is_demo
      )
      values (
        coalesce(auth.uid(), new.updated_by),
        coalesce(public.current_user_role(), current_user),
        new.institution_id,
        'blood_inventory',
        new.id,
        'inventory_updated',
        jsonb_build_object(
          'blood_group', old.blood_group,
          'units', old.units,
          'min_threshold', old.min_threshold
        ),
        jsonb_build_object(
          'blood_group', new.blood_group,
          'units', new.units,
          'min_threshold', new.min_threshold
        ),
        new.is_demo
      );
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_blood_inventory_changes on public.blood_inventory;
create trigger trg_audit_blood_inventory_changes
  after insert or update on public.blood_inventory
  for each row execute function public.audit_blood_inventory_changes();
