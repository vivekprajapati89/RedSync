import { supabase } from './supabaseClient';
import { computeInventoryStatus } from '../utils/calculations';

const VALID_BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

function mapInventoryRow(row) {
  const inst = row.institutions || {};
  return {
    id: row.id,
    institutionId: row.institution_id,
    institutionName: inst.name || 'Unknown Facility',
    institutionType: inst.type || 'Facility',
    location: inst.location || '',
    distanceKm: Number(inst.distance_km ?? 0),
    bloodGroup: row.blood_group,
    units: row.units,
    minThreshold: row.min_threshold,
    status: computeInventoryStatus(row.units, row.min_threshold),
    updatedAt: row.updated_at,
    isDemo: Boolean(row.is_demo),
  };
}

function mapInstitutionRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    distanceKm: Number(row.distance_km ?? 0),
    status: row.operational_status || 'Operational',
    approvalStatus: row.approval_status,
    isDemo: Boolean(row.is_demo),
  };
}

export async function fetchLiveInventory(isDemo) {
  const [{ data: invRows, error: invErr }, { data: instRows, error: instErr }] =
    await Promise.all([
      supabase
        .from('blood_inventory')
        .select(
          `
          id,
          institution_id,
          blood_group,
          units,
          min_threshold,
          is_demo,
          updated_at,
          institutions (
            id,
            name,
            type,
            location,
            distance_km,
            operational_status,
            approval_status,
            is_demo
          )
        `
        )
        .eq('is_demo', Boolean(isDemo))
        .order('blood_group', { ascending: true }),
      supabase
        .from('institutions')
        .select(
          'id, name, type, location, distance_km, operational_status, approval_status, is_demo'
        )
        .eq('is_demo', Boolean(isDemo))
        .eq('approval_status', 'approved')
        .order('name', { ascending: true }),
    ]);

  if (invErr) throw invErr;
  if (instErr) throw instErr;

  return {
    inventoryRecords: (invRows || []).map(mapInventoryRow),
    institutions: (instRows || []).map(mapInstitutionRow),
  };
}

export async function upsertOwnInventory({
  institutionId,
  bloodGroup,
  units,
  minThreshold,
  isDemo,
}) {
  if (!institutionId) {
    throw new Error('No institution associated with your account.');
  }
  if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    throw new Error('Please select a valid blood group.');
  }

  const parsedUnits = Number(units);
  const parsedThreshold = Number(minThreshold);

  if (!Number.isInteger(parsedUnits) || parsedUnits < 0 || parsedUnits > 10000) {
    throw new Error('Available quantity must be a whole number between 0 and 10,000.');
  }
  if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 5000) {
    throw new Error('Minimum stock level must be a whole number between 1 and 5,000.');
  }

  const { data, error } = await supabase
    .from('blood_inventory')
    .upsert(
      {
        institution_id: institutionId,
        blood_group: bloodGroup,
        units: parsedUnits,
        min_threshold: parsedThreshold,
        is_demo: Boolean(isDemo),
      },
      { onConflict: 'institution_id,blood_group' }
    )
    .select(
      `
      id,
      institution_id,
      blood_group,
      units,
      min_threshold,
      is_demo,
      updated_at,
      institutions (
        id,
        name,
        type,
        location,
        distance_km,
        operational_status,
        approval_status,
        is_demo
      )
    `
    )
    .single();

  if (error) throw error;
  return mapInventoryRow(data);
}
