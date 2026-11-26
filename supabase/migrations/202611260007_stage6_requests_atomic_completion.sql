-- RedSync Stage 6: Blood Requests Actor Enforcement, Atomic Completion RPC, and Realtime

-- 1. Enforce created_by = auth.uid() on client inserts to blood_requests
create or replace function public.enforce_blood_request_insert_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_blood_request_insert_actor on public.blood_requests;
create trigger trg_enforce_blood_request_insert_actor
  before insert on public.blood_requests
  for each row execute function public.enforce_blood_request_insert_actor();

-- 2. Block direct client UPDATE to 'Completed' (must go through complete_blood_request RPC)
create or replace function public.enforce_blood_request_workflow()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_inst uuid := public.current_user_institution_id();
  v_is_coord boolean := public.is_coordinator();
  v_is_demo boolean := public.is_demo_user();
  v_is_requester boolean;
  v_is_target boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    raise exception 'Direct completion is not permitted; use complete_blood_request RPC';
  end if;

  if v_is_demo and old.is_demo = true then
    return new;
  end if;

  -- Core request fields are immutable after creation
  if new.id is distinct from old.id
     or new.requesting_institution_id is distinct from old.requesting_institution_id
     or new.blood_group is distinct from old.blood_group
     or new.required_units is distinct from old.required_units
     or new.urgency is distinct from old.urgency
     or new.is_demo is distinct from old.is_demo
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Immutable blood request fields cannot be modified';
  end if;

  -- Once target_institution_id is assigned, it cannot be reassigned by ordinary participants
  if old.target_institution_id is not null
     and new.target_institution_id is distinct from old.target_institution_id
     and not v_is_coord then
    raise exception 'Target institution cannot be changed after assignment';
  end if;

  v_is_requester := (v_caller_inst = old.requesting_institution_id);
  v_is_target := (old.target_institution_id is not null and v_caller_inst = old.target_institution_id)
                 or (old.target_institution_id is null and v_caller_inst is not null and v_caller_inst <> old.requesting_institution_id);

  -- Enforce field ownership
  if v_is_requester and not v_is_coord then
    if new.response_note is distinct from old.response_note
       or new.responded_by is distinct from old.responded_by then
      raise exception 'Requesting institution cannot modify partner response fields';
    end if;
  end if;

  if v_is_target and not v_is_requester and not v_is_coord then
    if new.notes is distinct from old.notes then
      raise exception 'Target institution cannot modify requester notes';
    end if;
  end if;

  -- Enforce valid status transitions
  if new.status is distinct from old.status then
    if old.status = 'Completed' then
      raise exception 'Completed requests cannot be modified';
    end if;

    if old.status = 'Pending' and new.status in ('Accepted', 'Declined') then
      if not (v_is_target or v_is_coord) then
        raise exception 'Only the target institution or a coordinator can accept or decline a request';
      end if;
      if old.target_institution_id is null and new.target_institution_id is null then
        new.target_institution_id := v_caller_inst;
      end if;
      new.responded_by := v_uid;

    elsif old.status = 'Declined' and new.status = 'Pending' then
      if not (v_is_requester or v_is_coord) then
        raise exception 'Only the requesting institution or a coordinator can reopen a declined request';
      end if;

    else
      raise exception 'Invalid blood request status transition from % to %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

-- 3. Atomic Simulated Stock-Transfer & Request-Completion RPC
create or replace function public.complete_blood_request(
  p_request_id uuid,
  p_response_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_user_role();
  v_caller_inst uuid := public.current_user_institution_id();
  v_req public.blood_requests%rowtype;
  v_donor_inv public.blood_inventory%rowtype;
  v_recip_inv public.blood_inventory%rowtype;
  v_first_inst uuid;
  v_second_inst uuid;
  v_donor_before integer;
  v_recip_before integer;
  v_clean_note text := trim(coalesce(p_response_note, ''));
begin
  if v_uid is null or v_role is null then
    raise exception 'Authentication required';
  end if;

  -- Lock the request row to prevent concurrent / duplicate completions
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

  -- Authorization & demo isolation checks
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
    if not public.is_institution_approved(v_req.requesting_institution_id)
       or not public.is_institution_approved(v_req.target_institution_id) then
      raise exception 'Both institutions must have approved status to complete transfer';
    end if;
  end if;

  -- Lock inventory rows in deterministic UUID order to prevent deadlocks
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

  -- Deduct from donor institution
  update public.blood_inventory
  set
    units = units - v_req.required_units,
    updated_by = v_uid
  where id = v_donor_inv.id;

  -- Add to recipient institution (insert if recipient does not yet have a row for this blood group)
  select * into v_recip_inv
  from public.blood_inventory
  where institution_id = v_req.requesting_institution_id
    and blood_group = v_req.blood_group
    and is_demo = v_req.is_demo;

  if found then
    v_recip_before := v_recip_inv.units;
    update public.blood_inventory
    set
      units = units + v_req.required_units,
      updated_by = v_uid
    where id = v_recip_inv.id;
  else
    v_recip_before := 0;
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
    );
  end if;

  -- Mark request as Completed
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
      'recipient_units', v_recip_before + v_req.required_units
    ),
    v_req.is_demo
  );

  return jsonb_build_object(
    'request_id', v_req.id,
    'blood_group', v_req.blood_group,
    'transferred_units', v_req.required_units,
    'donor_units_after', v_donor_before - v_req.required_units,
    'recipient_units_after', v_recip_before + v_req.required_units
  );
end;
$$;

revoke all on function public.complete_blood_request(uuid, text) from public, anon;
grant execute on function public.complete_blood_request(uuid, text) to authenticated;

-- 4. Enable Realtime for public.blood_requests (RLS still filters row delivery)
alter table public.blood_requests replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'blood_requests'
  ) then
    alter publication supabase_realtime add table public.blood_requests;
  end if;
end $$;
