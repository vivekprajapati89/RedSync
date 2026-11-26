-- RedSync Stage 5: Consumption Logs Data Integrity, Audit Trail, and Realtime

-- 1. Revoke UPDATE and DELETE on consumption_logs from client roles (append-only history)
revoke update, delete on public.consumption_logs from anon, authenticated;

-- 2. Add bounded quantity & reasonable date-range constraints
alter table public.consumption_logs
  drop constraint if exists chk_consumption_units_consumed_bounded;

alter table public.consumption_logs
  add constraint chk_consumption_units_consumed_bounded
  check (units_consumed > 0 and units_consumed <= 5000);

alter table public.consumption_logs
  drop constraint if exists chk_consumption_units_replenished_bounded;

alter table public.consumption_logs
  add constraint chk_consumption_units_replenished_bounded
  check (units_replenished >= 0 and units_replenished <= 5000);

alter table public.consumption_logs
  drop constraint if exists chk_consumption_log_date_reasonable;

-- Allow +1 day buffer for UTC vs local timezone differences, block unreasonable future or ancient dates
alter table public.consumption_logs
  add constraint chk_consumption_log_date_reasonable
  check (log_date <= (current_date + 1) and log_date >= (current_date - 365));

-- 3. Enforce logged_by = auth.uid() on client inserts
create or replace function public.enforce_consumption_log_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.logged_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_consumption_log_actor on public.consumption_logs;
create trigger trg_enforce_consumption_log_actor
  before insert on public.consumption_logs
  for each row execute function public.enforce_consumption_log_actor();

-- 4. Audit trail for consumption_logs inserts
create or replace function public.audit_consumption_log_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    coalesce(auth.uid(), new.logged_by),
    coalesce(public.current_user_role(), current_user),
    new.institution_id,
    'consumption_logs',
    new.id,
    'consumption_logged',
    jsonb_build_object(
      'log_date', new.log_date,
      'blood_group', new.blood_group,
      'department', new.department,
      'units_consumed', new.units_consumed,
      'units_replenished', new.units_replenished
    ),
    new.is_demo
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_consumption_log_insert on public.consumption_logs;
create trigger trg_audit_consumption_log_insert
  after insert on public.consumption_logs
  for each row execute function public.audit_consumption_log_insert();

-- 5. Add consumption_logs to Realtime publication (RLS governs row delivery)
alter table public.consumption_logs replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'consumption_logs'
  ) then
    alter publication supabase_realtime add table public.consumption_logs;
  end if;
end $$;
