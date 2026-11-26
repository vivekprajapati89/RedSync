import { supabase } from './supabaseClient';

const VALID_BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const VALID_DEPARTMENTS = [
  'Emergency & Trauma',
  'Surgical Procedures',
  'Oncology & Hematology',
  'Maternity & NICU',
  'General Inpatient',
];

export function formatLocalDateISO(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function relativeDayToDateString(dayLabel) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dayLabel === 'Today') return formatLocalDateISO(today);
  const match = /^Day -(\d+)$/.exec(dayLabel || '');
  if (match) {
    const offset = Number(match[1]);
    const target = new Date(today);
    target.setDate(today.getDate() - offset);
    return formatLocalDateISO(target);
  }
  return dayLabel;
}

export function dateStringToRelativeDay(dateStr) {
  if (!dateStr) return 'Today';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 'Today';
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays <= 6) return `Day -${diffDays}`;
  return dateStr;
}

function mapConsumptionRow(row) {
  return {
    id: row.id,
    institutionId: row.institution_id,
    institutionName: row.institutions?.name || 'Facility',
    logDate: row.log_date,
    day: dateStringToRelativeDay(row.log_date),
    bloodGroup: row.blood_group,
    department: row.department,
    unitsConsumed: row.units_consumed,
    unitsReplenished: row.units_replenished,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
  };
}

export async function fetchConsumptionLogs(isDemo) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const minDate = formatLocalDateISO(sevenDaysAgo);

  const { data, error } = await supabase
    .from('consumption_logs')
    .select(
      `
      id,
      institution_id,
      log_date,
      blood_group,
      department,
      units_consumed,
      units_replenished,
      is_demo,
      created_at,
      institutions (
        id,
        name
      )
    `
    )
    .eq('is_demo', Boolean(isDemo))
    .gte('log_date', minDate)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapConsumptionRow);
}

export async function insertConsumptionLog({
  institutionId,
  logDate,
  bloodGroup,
  department,
  unitsConsumed,
  unitsReplenished,
  isDemo,
}) {
  if (!institutionId) {
    throw new Error('No institution associated with your account.');
  }
  if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    throw new Error('Please select a valid blood group.');
  }
  if (!VALID_DEPARTMENTS.includes(department)) {
    throw new Error('Please select a valid clinical department.');
  }

  const parsedConsumed = Number(unitsConsumed);
  const parsedReplenished = Number(unitsReplenished);

  if (!Number.isInteger(parsedConsumed) || parsedConsumed < 1 || parsedConsumed > 5000) {
    throw new Error('Units consumed must be a positive whole number between 1 and 5,000.');
  }
  if (!Number.isInteger(parsedReplenished) || parsedReplenished < 0 || parsedReplenished > 5000) {
    throw new Error('Stock added must be a whole number between 0 and 5,000.');
  }

  const resolvedDate =
    logDate && /^\d{4}-\d{2}-\d{2}$/.test(logDate)
      ? logDate
      : relativeDayToDateString(logDate || 'Today');

  const todayStr = formatLocalDateISO(new Date());
  const minAllowed = new Date();
  minAllowed.setDate(minAllowed.getDate() - 365);
  const minStr = formatLocalDateISO(minAllowed);

  if (resolvedDate > todayStr) {
    throw new Error('Log date cannot be in the future.');
  }
  if (resolvedDate < minStr) {
    throw new Error('Log date cannot be more than 365 days in the past.');
  }

  const { data, error } = await supabase
    .from('consumption_logs')
    .insert({
      institution_id: institutionId,
      log_date: resolvedDate,
      blood_group: bloodGroup,
      department,
      units_consumed: parsedConsumed,
      units_replenished: parsedReplenished,
      is_demo: Boolean(isDemo),
    })
    .select(
      `
      id,
      institution_id,
      log_date,
      blood_group,
      department,
      units_consumed,
      units_replenished,
      is_demo,
      created_at,
      institutions (
        id,
        name
      )
    `
    )
    .single();

  if (error) throw error;
  return mapConsumptionRow(data);
}
