-- RedSync Stage 3: Authorization Helpers, Institution Approval Workflow, RLS Policies, and Audit Protection

-- ============================================================================
-- 1. Non-recursive Security Helper Functions
-- ============================================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true;
$$;

create or replace function public.current_user_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institution_id
  from public.profiles
  where id = auth.uid()
    and is_active = true;
$$;

create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'network_coordinator', false);
$$;

create or replace function public.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'demo_user', false);
$$;

create or replace function public.is_institution_approved(p_inst_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.institutions
    where id = p_inst_id
      and approval_status = 'approved'
      and is_demo = false
  );
$$;

create or replace function public.is_own_institution_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_user_role() in ('institution_admin', 'staff')
    and public.is_institution_approved(public.current_user_institution_id()),
    false
  );
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_institution_id() from public, anon;
revoke all on function public.is_coordinator() from public, anon;
revoke all on function public.is_demo_user() from public, anon;
revoke all on function public.is_institution_approved(uuid) from public, anon;
revoke all on function public.is_own_institution_approved() from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_institution_id() to authenticated;
grant execute on function public.is_coordinator() to authenticated;
grant execute on function public.is_demo_user() to authenticated;
grant execute on function public.is_institution_approved(uuid) to authenticated;
grant execute on function public.is_own_institution_approved() to authenticated;

-- ============================================================================
-- 2. Institution Approval Workflow RPC (Coordinator-Only, Audited)
-- ============================================================================

create or replace function public.review_institution_registration(
  p_institution_id uuid,
  p_new_status text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inst public.institutions%rowtype;
  v_action text;
begin
  if v_uid is null or not public.is_coordinator() then
    raise exception 'Coordinator privileges required';
  end if;

  if p_new_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid approval status transition: %', p_new_status;
  end if;

  select *
  into v_inst
  from public.institutions
  where id = p_institution_id
  for update;

  if not found then
    raise exception 'Institution not found';
  end if;

  if v_inst.is_demo then
    raise exception 'Demo institutions cannot be modified via coordinator approval';
  end if;

  if v_inst.id = public.current_user_institution_id() then
    raise exception 'Coordinators cannot approve or modify their own institution';
  end if;

  update public.institutions
  set
    approval_status = p_new_status,
    approved_by = v_uid,
    approved_at = now()
  where id = p_institution_id;

  v_action := 'institution_' || p_new_status;

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
    v_uid,
    'network_coordinator',
    p_institution_id,
    'institutions',
    p_institution_id,
    v_action,
    jsonb_build_object('approval_status', v_inst.approval_status),
    jsonb_build_object(
      'approval_status', p_new_status,
      'reason', trim(coalesce(p_reason, ''))
    ),
    false
  );
end;
$$;

revoke all on function public.review_institution_registration(uuid, text, text) from public, anon;
grant execute on function public.review_institution_registration(uuid, text, text) to authenticated;

-- ============================================================================
-- 3. Role & Security Event Audit Trigger on Profiles
-- ============================================================================

create or replace function public.audit_profile_security_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.institution_id is distinct from old.institution_id
     or new.is_active is distinct from old.is_active then
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
      auth.uid(),
      coalesce(public.current_user_role(), current_user),
      coalesce(new.institution_id, old.institution_id),
      'profiles',
      new.id,
      'profile_security_updated',
      jsonb_build_object(
        'role', old.role,
        'institution_id', old.institution_id,
        'is_active', old.is_active
      ),
      jsonb_build_object(
        'role', new.role,
        'institution_id', new.institution_id,
        'is_active', new.is_active
      ),
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_profile_security_changes on public.profiles;
create trigger trg_audit_profile_security_changes
  after update on public.profiles
  for each row execute function public.audit_profile_security_changes();

-- ============================================================================
-- 4. Row Level Security Policies (Replace Stage 2 minimal policies cleanly)
-- ============================================================================

-- 4a. institutions
drop policy if exists "institutions_select_own" on public.institutions;
drop policy if exists "institutions_select_authorized" on public.institutions;

create policy "institutions_select_authorized"
  on public.institutions
  for select
  to authenticated
  using (
    public.is_coordinator()
    or id = public.current_user_institution_id()
    or (public.is_own_institution_approved() and approval_status = 'approved' and is_demo = false)
    or (public.is_demo_user() and is_demo = true and approval_status = 'approved')
  );

-- 4b. profiles
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authorized" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_authorized"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or public.is_coordinator()
    or (
      public.current_user_role() = 'institution_admin'
      and public.is_own_institution_approved()
      and institution_id = public.current_user_institution_id()
    )
  );

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4c. blood_inventory
drop policy if exists "blood_inventory_select_authorized" on public.blood_inventory;
drop policy if exists "blood_inventory_insert_authorized" on public.blood_inventory;
drop policy if exists "blood_inventory_update_authorized" on public.blood_inventory;

create policy "blood_inventory_select_authorized"
  on public.blood_inventory
  for select
  to authenticated
  using (
    (public.is_coordinator() and is_demo = false)
    or (
      public.is_own_institution_approved()
      and is_demo = false
      and public.is_institution_approved(institution_id)
    )
    or (public.is_demo_user() and is_demo = true)
  );

create policy "blood_inventory_insert_authorized"
  on public.blood_inventory
  for insert
  to authenticated
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
        select 1 from public.institutions i
        where i.id = institution_id and i.is_demo = true and i.approval_status = 'approved'
      )
    )
  );

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
    or (public.is_demo_user() and is_demo = true)
  )
  with check (
    (
      public.is_own_institution_approved()
      and institution_id = public.current_user_institution_id()
      and is_demo = false
    )
    or (public.is_demo_user() and is_demo = true)
  );

-- 4d. consumption_logs
drop policy if exists "consumption_logs_select_authorized" on public.consumption_logs;
drop policy if exists "consumption_logs_insert_authorized" on public.consumption_logs;

create policy "consumption_logs_select_authorized"
  on public.consumption_logs
  for select
  to authenticated
  using (
    (public.is_coordinator() and is_demo = false)
    or (
      public.is_own_institution_approved()
      and institution_id = public.current_user_institution_id()
      and is_demo = false
    )
    or (public.is_demo_user() and is_demo = true)
  );

create policy "consumption_logs_insert_authorized"
  on public.consumption_logs
  for insert
  to authenticated
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
        select 1 from public.institutions i
        where i.id = institution_id and i.is_demo = true and i.approval_status = 'approved'
      )
    )
  );

-- 4e. blood_requests
drop policy if exists "blood_requests_select_authorized" on public.blood_requests;
drop policy if exists "blood_requests_insert_authorized" on public.blood_requests;
drop policy if exists "blood_requests_update_authorized" on public.blood_requests;

create policy "blood_requests_select_authorized"
  on public.blood_requests
  for select
  to authenticated
  using (
    (public.is_coordinator() and is_demo = false)
    or (
      public.is_own_institution_approved()
      and is_demo = false
      and (
        requesting_institution_id = public.current_user_institution_id()
        or target_institution_id = public.current_user_institution_id()
        or target_institution_id is null
      )
    )
    or (public.is_demo_user() and is_demo = true)
  );

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
    )
    or (
      public.is_demo_user()
      and is_demo = true
      and status = 'Pending'
      and exists (
        select 1 from public.institutions i
        where i.id = requesting_institution_id and i.is_demo = true
      )
    )
  );

create policy "blood_requests_update_authorized"
  on public.blood_requests
  for update
  to authenticated
  using (
    (public.is_coordinator() and is_demo = false)
    or (
      public.is_own_institution_approved()
      and is_demo = false
      and (
        requesting_institution_id = public.current_user_institution_id()
        or target_institution_id = public.current_user_institution_id()
      )
    )
    or (public.is_demo_user() and is_demo = true)
  )
  with check (
    (public.is_coordinator() and is_demo = false)
    or (
      public.is_own_institution_approved()
      and is_demo = false
      and (
        requesting_institution_id = public.current_user_institution_id()
        or target_institution_id = public.current_user_institution_id()
      )
    )
    or (public.is_demo_user() and is_demo = true)
  );

-- 4f. safety_configs
drop policy if exists "safety_configs_select_authorized" on public.safety_configs;
drop policy if exists "safety_configs_insert_coordinator" on public.safety_configs;
drop policy if exists "safety_configs_update_coordinator" on public.safety_configs;

create policy "safety_configs_select_authorized"
  on public.safety_configs
  for select
  to authenticated
  using (
    (public.is_coordinator() and is_demo = false)
    or (
      public.is_own_institution_approved()
      and is_demo = false
      and (institution_id is null or institution_id = public.current_user_institution_id())
    )
    or (public.is_demo_user() and is_demo = true)
  );

create policy "safety_configs_insert_coordinator"
  on public.safety_configs
  for insert
  to authenticated
  with check (public.is_coordinator() and is_demo = false);

create policy "safety_configs_update_coordinator"
  on public.safety_configs
  for update
  to authenticated
  using (public.is_coordinator() and is_demo = false)
  with check (public.is_coordinator() and is_demo = false);

-- 4g. audit_logs (read-only for coordinators and approved institution admins; no client writes)
drop policy if exists "audit_logs_select_authorized" on public.audit_logs;

create policy "audit_logs_select_authorized"
  on public.audit_logs
  for select
  to authenticated
  using (
    public.is_coordinator()
    or (
      public.current_user_role() = 'institution_admin'
      and public.is_own_institution_approved()
      and institution_id = public.current_user_institution_id()
      and is_demo = false
    )
  );
