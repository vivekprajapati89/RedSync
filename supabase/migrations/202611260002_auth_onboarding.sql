-- RedSync Stage 2: Authentication, Secure Profile Provisioning, and Institution Onboarding
-- Preserves default-deny on inventory/consumption/requests/audit_logs until Stage 3.

-- 1. Allow newly signed-up staff profiles to have institution_id = NULL until onboarding completes
alter table public.profiles
  drop constraint if exists chk_profile_institution_binding;

alter table public.profiles
  add constraint chk_profile_institution_binding check (
    role in ('network_coordinator', 'demo_user', 'staff') or institution_id is not null
  );

-- 2. Secure automatic profile provisioning on auth.users insert
-- Always assigns role = 'staff' and institution_id = NULL regardless of client metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );

  insert into public.profiles (id, full_name, email, role, institution_id, is_active)
  values (new.id, v_full_name, coalesce(new.email, ''), 'staff', null, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Prevent clients from self-elevating role, changing institution_id, or toggling is_active.
-- Direct PostgREST client requests execute as current_user = 'authenticated' / 'anon',
-- whereas trusted SECURITY DEFINER functions execute as the function owner ('postgres').
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'Cannot modify profile role directly';
    end if;
    if new.institution_id is distinct from old.institution_id then
      raise exception 'Cannot modify institution binding directly';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Cannot modify active status directly';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileged_fields on public.profiles;
create trigger trg_protect_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

-- 4. Minimal Stage 2 RLS Policies (Profiles & Own Institution Read Only)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "institutions_select_own" on public.institutions;
create policy "institutions_select_own"
  on public.institutions
  for select
  to authenticated
  using (
    id = (
      select p.institution_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

-- 5. Narrowly scoped institution registration RPC
-- Creates a pending institution (is_demo = false) and binds the caller's profile without elevating role.
create or replace function public.register_institution(
  p_name text,
  p_type text,
  p_location text,
  p_contact_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_inst uuid;
  v_new_inst_id uuid;
  v_clean_name text := trim(coalesce(p_name, ''));
  v_clean_location text := trim(coalesce(p_location, ''));
  v_clean_contact text := trim(coalesce(p_contact_name, ''));
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if length(v_clean_name) < 3 then
    raise exception 'Institution name must be at least 3 characters';
  end if;

  if p_type not in ('Regional Blood Bank', 'Trauma Center', 'General Hospital', 'Specialty Hospital') then
    raise exception 'Invalid institution type';
  end if;

  if length(v_clean_location) < 3 then
    raise exception 'Location must be at least 3 characters';
  end if;

  select institution_id
  into v_existing_inst
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_existing_inst is not null then
    raise exception 'User is already linked to an institution';
  end if;

  insert into public.institutions (
    name,
    type,
    location,
    operational_status,
    approval_status,
    is_demo
  )
  values (
    v_clean_name,
    p_type,
    v_clean_location,
    'Operational',
    'pending',
    false
  )
  returning id into v_new_inst_id;

  update public.profiles
  set
    institution_id = v_new_inst_id,
    full_name = case when length(v_clean_contact) >= 2 then v_clean_contact else full_name end
  where id = v_uid;

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
    v_uid,
    'staff',
    v_new_inst_id,
    'institutions',
    v_new_inst_id,
    'institution_registered',
    jsonb_build_object(
      'name', v_clean_name,
      'type', p_type,
      'location', v_clean_location,
      'approval_status', 'pending'
    ),
    false
  );

  return v_new_inst_id;
end;
$$;

revoke all on function public.register_institution(text, text, text, text) from public, anon;
grant execute on function public.register_institution(text, text, text, text) to authenticated;
