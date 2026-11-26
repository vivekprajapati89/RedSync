-- RedSync Security Fix 4: Authorization Hardening & Database Privilege Cleanup
-- 1. Restrict register_institution(...) to active staff accounts only
-- 2. Strengthen blood_inventory_update_authorized for demo_user institution isolation
-- 3. Strengthen blood_requests_insert_authorized for demo_user target institution isolation
-- 4. Revoke unnecessary TRUNCATE, REFERENCES, TRIGGER (and anon write) privileges on all 7 public tables

-- ============================================================================
-- FINDING 1: Restrict Institution Registration by Role & Active Status
-- ============================================================================
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
  v_role text;
  v_existing_inst uuid;
  v_is_active boolean;
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

  select role, institution_id, is_active
  into v_role, v_existing_inst, v_is_active
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if not v_is_active then
    raise exception 'Inactive user accounts cannot register an institution';
  end if;

  if v_role is distinct from 'staff' then
    raise exception 'Only eligible staff accounts can register an institution';
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

-- ============================================================================
-- FINDING 2: Strengthen Demo Inventory Update Authorization
-- ============================================================================
drop policy if exists "blood_inventory_update_authorized" on public.blood_inventory;
create policy "blood_inventory_update_authorized"
on public.blood_inventory
for update
to authenticated
using (
  (
    public.is_own_institution_approved()
    and institution_id = public.current_user_institution_id()
    and is_demo = false
  )
  or (
    public.is_demo_user()
    and is_demo = true
    and exists (
      select 1
      from public.institutions i
      where i.id = blood_inventory.institution_id
        and i.is_demo = true
    )
  )
)
with check (
  (
    public.is_own_institution_approved()
    and institution_id = public.current_user_institution_id()
    and is_demo = false
  )
  or (
    public.is_demo_user()
    and is_demo = true
    and exists (
      select 1
      from public.institutions i
      where i.id = blood_inventory.institution_id
        and i.is_demo = true
    )
  )
);

-- ============================================================================
-- FINDING 3: Strengthen Demo Blood Request Target Authorization
-- ============================================================================
drop policy if exists "blood_requests_insert_authorized" on public.blood_requests;
create policy "blood_requests_insert_authorized"
on public.blood_requests
for insert
to authenticated
with check (
  (
    public.is_own_institution_approved()
    and requesting_institution_id = public.current_user_institution_id()
    and is_demo = false
    and status = 'Pending'
    and (
      target_institution_id is null
      or private.is_institution_approved(target_institution_id)
    )
  )
  or (
    public.is_demo_user()
    and is_demo = true
    and status = 'Pending'
    and exists (
      select 1
      from public.institutions i
      where i.id = blood_requests.requesting_institution_id
        and i.is_demo = true
    )
    and (
      target_institution_id is null
      or exists (
        select 1
        from public.institutions t
        where t.id = blood_requests.target_institution_id
          and t.is_demo = true
      )
    )
  )
);

-- ============================================================================
-- FINDING 4: Database Table Privilege Hardening
-- ============================================================================
revoke truncate, references, trigger on table public.audit_logs from public, anon, authenticated;
revoke truncate, references, trigger on table public.blood_inventory from public, anon, authenticated;
revoke truncate, references, trigger on table public.blood_requests from public, anon, authenticated;
revoke truncate, references, trigger on table public.consumption_logs from public, anon, authenticated;
revoke truncate, references, trigger on table public.institutions from public, anon, authenticated;
revoke truncate, references, trigger on table public.profiles from public, anon, authenticated;
revoke truncate, references, trigger on table public.safety_configs from public, anon, authenticated;

revoke insert, update, delete on table public.audit_logs from anon;
revoke insert, update, delete on table public.blood_inventory from anon;
revoke insert, update, delete on table public.blood_requests from anon;
revoke insert, update, delete on table public.consumption_logs from anon;
revoke insert, update, delete on table public.institutions from anon;
revoke insert, update, delete on table public.profiles from anon;
revoke insert, update, delete on table public.safety_configs from anon;
