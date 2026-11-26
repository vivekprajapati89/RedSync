-- RedSync Stage 6.6: Enforce full workflow & field immutability rules on demo requests
-- Removes the early bypass for demo_user while preserving demo sandbox role-play capabilities.

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

  -- Strict demo/non-demo isolation
  if v_is_demo and not old.is_demo then
    raise exception 'Demo users cannot modify non-demo requests';
  end if;

  if not v_is_demo and old.is_demo and not v_is_coord then
    raise exception 'Non-demo users cannot modify demo requests';
  end if;

  -- Core request fields are immutable after creation (applies to both demo and non-demo)
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

  if new.target_institution_id is not null
     and new.target_institution_id = old.requesting_institution_id then
    raise exception 'Target institution cannot match requesting institution';
  end if;

  if v_is_demo and old.is_demo then
    -- Demo sandbox allows a demo user to simulate both sides, while enforcing valid status transitions
    v_is_requester := true;
    v_is_target := true;
  else
    v_is_requester := (v_caller_inst = old.requesting_institution_id);
    v_is_target := (old.target_institution_id is not null and v_caller_inst = old.target_institution_id)
                   or (old.target_institution_id is null and v_caller_inst is not null and v_caller_inst <> old.requesting_institution_id);

    -- Enforce field ownership for non-demo participants
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
  end if;

  -- Enforce valid status transitions (applies to both demo and non-demo)
  if new.status is distinct from old.status then
    if old.status = 'Completed' then
      raise exception 'Completed requests cannot be modified';
    end if;

    if old.status = 'Pending' and new.status in ('Accepted', 'Declined') then
      if not (v_is_target or v_is_coord) then
        raise exception 'Only the target institution or a coordinator can accept or decline a request';
      end if;
      if old.target_institution_id is null and new.target_institution_id is null and not v_is_demo then
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
