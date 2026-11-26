-- RedSync Stage 3.5: Authorization Edge-Case Hardening
-- Fixes blood_requests field/status manipulation, institution deletion protection, and audit defense-in-depth.

-- 1. Defense-in-depth: revoke direct write privileges on audit_logs from client roles
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- 2. Prevent destructive deletion of non-demo institutions (enforce suspension instead)
create or replace function public.prevent_non_demo_institution_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_demo = false then
    raise exception 'Non-demo institutions cannot be deleted; use suspension instead';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_non_demo_institution_delete on public.institutions;
create trigger trg_prevent_non_demo_institution_delete
  before delete on public.institutions
  for each row execute function public.prevent_non_demo_institution_delete();

-- 3. Tighten blood_requests INSERT policy to require approved target_institution_id (when specified)
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
        or public.is_institution_approved(target_institution_id)
      )
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

-- 4. Enforce blood_requests workflow & field immutability on UPDATE
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

    elsif old.status = 'Accepted' and new.status = 'Completed' then
      if not (v_is_target or v_is_coord) then
        raise exception 'Only the target institution or a coordinator can mark a request completed';
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

drop trigger if exists trg_enforce_blood_request_workflow on public.blood_requests;
create trigger trg_enforce_blood_request_workflow
  before update on public.blood_requests
  for each row execute function public.enforce_blood_request_workflow();

-- 5. Audit logging trigger for blood_requests lifecycle
create or replace function public.audit_blood_request_changes()
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
      coalesce(auth.uid(), new.created_by),
      coalesce(public.current_user_role(), current_user),
      new.requesting_institution_id,
      'blood_requests',
      new.id,
      'request_created',
      jsonb_build_object(
        'blood_group', new.blood_group,
        'required_units', new.required_units,
        'status', new.status,
        'target_institution_id', new.target_institution_id
      ),
      new.is_demo
    );
    return new;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
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
      coalesce(auth.uid(), new.responded_by),
      coalesce(public.current_user_role(), current_user),
      coalesce(new.target_institution_id, new.requesting_institution_id),
      'blood_requests',
      new.id,
      'request_status_' || lower(new.status),
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status, 'response_note', new.response_note),
      new.is_demo
    );
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_blood_request_changes on public.blood_requests;
create trigger trg_audit_blood_request_changes
  after insert or update on public.blood_requests
  for each row execute function public.audit_blood_request_changes();
