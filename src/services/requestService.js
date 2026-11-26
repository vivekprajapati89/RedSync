import { supabase } from './supabaseClient';

const VALID_BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const VALID_URGENCIES = ['Critical', 'High', 'Moderate'];

const REQUEST_SELECT = `
  id,
  requesting_institution_id,
  target_institution_id,
  blood_group,
  required_units,
  urgency,
  status,
  notes,
  response_note,
  is_demo,
  created_by,
  responded_by,
  created_at,
  updated_at,
  requesting_inst:institutions!blood_requests_requesting_institution_id_fkey (
    id,
    name
  ),
  target_inst:institutions!blood_requests_target_institution_id_fkey (
    id,
    name
  )
`;

function mapRequestRow(row) {
  return {
    id: row.id,
    requestingInstitutionId: row.requesting_institution_id,
    requestingInstitutionName: row.requesting_inst?.name || 'Requesting Facility',
    targetInstitutionId: row.target_institution_id || null,
    respondedByInstitutionName: row.target_inst?.name || null,
    bloodGroup: row.blood_group,
    requiredUnits: row.required_units,
    urgency: row.urgency,
    status: row.status,
    notes: row.notes || '',
    responseNote: row.response_note || '',
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchRequests(isDemo) {
  const { data, error } = await supabase
    .from('blood_requests')
    .select(REQUEST_SELECT)
    .eq('is_demo', Boolean(isDemo))
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRequestRow);
}

export async function createBloodRequest({
  requestingInstitutionId,
  targetInstitutionId,
  bloodGroup,
  requiredUnits,
  urgency,
  notes,
  isDemo,
}) {
  if (!requestingInstitutionId) {
    throw new Error('Requesting institution is required.');
  }
  if (targetInstitutionId && targetInstitutionId === requestingInstitutionId) {
    throw new Error('Cannot request blood from your own institution.');
  }
  if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    throw new Error('Invalid blood group.');
  }

  const parsedUnits = Number(requiredUnits);
  if (!Number.isInteger(parsedUnits) || parsedUnits < 1 || parsedUnits > 5000) {
    throw new Error('Required units must be a whole number between 1 and 5,000.');
  }

  const safeUrgency = VALID_URGENCIES.includes(urgency) ? urgency : 'High';

  const { data, error } = await supabase
    .from('blood_requests')
    .insert({
      requesting_institution_id: requestingInstitutionId,
      target_institution_id: targetInstitutionId || null,
      blood_group: bloodGroup,
      required_units: parsedUnits,
      urgency: safeUrgency,
      status: 'Pending',
      notes: (notes || '').trim(),
      is_demo: Boolean(isDemo),
    })
    .select(REQUEST_SELECT)
    .single();

  if (error) throw error;
  return mapRequestRow(data);
}

export async function updateRequestStatus({ requestId, status, responseNote }) {
  if (!['Accepted', 'Declined', 'Pending'].includes(status)) {
    throw new Error('Invalid status transition.');
  }

  const payload = { status };
  if (responseNote !== undefined) {
    payload.response_note = String(responseNote).trim();
  }

  const { data, error } = await supabase
    .from('blood_requests')
    .update(payload)
    .eq('id', requestId)
    .select(REQUEST_SELECT)
    .single();

  if (error) throw error;
  return mapRequestRow(data);
}

export async function completeBloodRequest({ requestId, responseNote }) {
  const { data, error } = await supabase.rpc('complete_blood_request', {
    p_request_id: requestId,
    p_response_note: (responseNote || '').trim(),
  });

  if (error) throw error;
  return data;
}
