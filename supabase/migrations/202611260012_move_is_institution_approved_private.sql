-- RedSync Security Fix 3: Move is_institution_approved(uuid) to private schema
-- Removes public.is_institution_approved(uuid) from the exposed PostgREST API
-- while preserving all RLS policies, helper functions, and RPC behavior.

-- 1. Create non-exposed private schema with minimal grants
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- 2. Create private.is_institution_approved(uuid) with identical logic and safe search_path
create or replace function private.is_institution_approved(p_inst_id uuid)
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

revoke all on function private.is_institution_approved(uuid) from public, anon;
grant execute on function private.is_institution_approved(uuid) to authenticated, service_role;

-- 3. Update dependent function: public.is_own_institution_approved()
create or replace function public.is_own_institution_approved()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(
    public.current_user_role() in ('institution_admin', 'staff')
    and private.is_institution_approved(public.current_user_institution_id()),
    false
  );
$$;

-- 4. Update dependent function: public.complete_blood_request(uuid, text)
create or replace function public.complete_blood_request(
  p_request_id uuid,
  p_response_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_user_role();
  v_caller_inst uuid := public.current_user_institution_id();
  v_req public.blood_requests%rowtype;
  v_donor_inv public.blood_inventory%rowtype;
  v_first_inst uuid;
  v_second_inst uuid;
  v_donor_before integer;
  v_recip_before integer := 0;
  v_recip_after integer;
  v_clean_note text := trim(coalesce(p_response_note, ''));
begin
  if v_uid is null or v_role is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_req
  from public.blood_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Blood request not found';
  end if;

  if v_req.status = 'Completed' then
    raise exception 'Request is already completed';
  end if;

  if v_req.status <> 'Accepted' then
    raise exception 'Only Accepted requests can be completed (current status: %)', v_req.status;
  end if;

  if v_req.target_institution_id is null then
    raise exception 'Target institution must be assigned before completion';
  end if;

  if v_req.target_institution_id = v_req.requesting_institution_id then
    raise exception 'Donor and recipient institutions must be distinct';
  end if;

  if v_req.is_demo then
    if v_role <> 'demo_user' then
      raise exception 'Only demo users can complete demo requests';
    end if;
    if not exists (
      select 1 from public.institutions
      where id = v_req.requesting_institution_id and is_demo = true and approval_status = 'approved'
    ) or not exists (
      select 1 from public.institutions
      where id = v_req.target_institution_id and is_demo = true and approval_status = 'approved'
    ) then
      raise exception 'Both demo institutions must be active';
    end if;
  else
    if v_role = 'demo_user' then
      raise exception 'Demo users cannot complete non-demo requests';
    end if;
    if v_role <> 'network_coordinator' then
      if not public.is_own_institution_approved() or v_caller_inst <> v_req.target_institution_id then
        raise exception 'Only the fulfilling target institution or a coordinator can complete this request';
      end if;
    end if;
    if not private.is_institution_approved(v_req.requesting_institution_id)
       or not private.is_institution_approved(v_req.target_institution_id) then
      raise exception 'Both institutions must have approved status to complete transfer';
    end if;
  end if;

  -- Deterministic lock order to prevent deadlocks
  if v_req.target_institution_id < v_req.requesting_institution_id then
    v_first_inst := v_req.target_institution_id;
    v_second_inst := v_req.requesting_institution_id;
  else
    v_first_inst := v_req.requesting_institution_id;
    v_second_inst := v_req.target_institution_id;
  end if;

  perform 1 from public.blood_inventory
  where institution_id = v_first_inst and blood_group = v_req.blood_group
  for update;

  perform 1 from public.blood_inventory
  where institution_id = v_second_inst and blood_group = v_req.blood_group
  for update;

  select * into v_donor_inv
  from public.blood_inventory
  where institution_id = v_req.target_institution_id
    and blood_group = v_req.blood_group
    and is_demo = v_req.is_demo;

  if not found or v_donor_inv.units < v_req.required_units then
    raise exception 'Insufficient donor inventory (% units available, % required)',
      coalesce(v_donor_inv.units, 0), v_req.required_units;
  end if;

  v_donor_before := v_donor_inv.units;

  select coalesce(units, 0) into v_recip_before
  from public.blood_inventory
  where institution_id = v_req.requesting_institution_id
    and blood_group = v_req.blood_group
    and is_demo = v_req.is_demo;

  if not found then
    v_recip_before := 0;
  end if;

  -- Deduct from donor
  update public.blood_inventory
  set
    units = units - v_req.required_units,
    updated_by = v_uid
  where id = v_donor_inv.id;

  -- Race-safe recipient upsert
  insert into public.blood_inventory (
    institution_id,
    blood_group,
    units,
    min_threshold,
    is_demo,
    updated_by
  )
  values (
    v_req.requesting_institution_id,
    v_req.blood_group,
    v_req.required_units,
    10,
    v_req.is_demo,
    v_uid
  )
  on conflict (institution_id, blood_group) do update
  set
    units = public.blood_inventory.units + excluded.units,
    updated_by = excluded.updated_by
  returning units into v_recip_after;

  -- Mark request Completed
  update public.blood_requests
  set
    status = 'Completed',
    responded_by = v_uid,
    response_note = case
      when length(v_clean_note) > 0 then v_clean_note
      when length(trim(coalesce(response_note, ''))) > 0 then response_note
      else 'Simulated transfer completed.'
    end
  where id = v_req.id;

  -- Record atomic transfer summary in audit_logs
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
    v_role,
    v_req.target_institution_id,
    'blood_requests',
    v_req.id,
    'request_transfer_completed',
    jsonb_build_object(
      'donor_institution_id', v_req.target_institution_id,
      'donor_units', v_donor_before,
      'recipient_institution_id', v_req.requesting_institution_id,
      'recipient_units', v_recip_before
    ),
    jsonb_build_object(
      'blood_group', v_req.blood_group,
      'transferred_units', v_req.required_units,
      'donor_units', v_donor_before - v_req.required_units,
      'recipient_units', v_recip_after
    ),
    v_req.is_demo
  );

  return jsonb_build_object(
    'request_id', v_req.id,
    'blood_group', v_req.blood_group,
    'transferred_units', v_req.required_units,
    'donor_units_after', v_donor_before - v_req.required_units,
    'recipient_units_after', v_recip_after
  );
end;
$$;

-- 5. Update dependent RLS policies
drop policy if exists "blood_inventory_select_authorized" on public.blood_inventory;
create policy "blood_inventory_select_authorized"
on public.blood_inventory
for select
to authenticated
using (
  (public.is_coordinator() and is_demo = false)
  or (
    public.is_own_institution_approved()
    and is_demo = false
    and private.is_institution_approved(institution_id)
  )
  or (public.is_demo_user() and is_demo = true)
);

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
      select 1 from public.institutions i
      where i.id = blood_requests.requesting_institution_id
        and i.is_demo = true
    )
  )
);

-- 6. Revoke and drop the old public helper
revoke all on function public.is_institution_approved(uuid) from public, anon, authenticated;
drop function if exists public.is_institution_approved(uuid);
