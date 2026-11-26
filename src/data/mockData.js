/**
 * Seed data for RedSync hackathon prototype.
 * All institutions, inventory counts, consumption records, and requests are fictional.
 */

export const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export const DEPARTMENTS = [
  'Emergency & Trauma',
  'Surgical Procedures',
  'Oncology & Hematology',
  'Maternity & NICU',
  'General Inpatient',
];

export const DAYS_ORDER = ['Day -6', 'Day -5', 'Day -4', 'Day -3', 'Day -2', 'Day -1', 'Today'];

export const INSTITUTIONS = [
  {
    id: 'inst-1',
    name: 'Metro Central Blood Bank',
    type: 'Regional Blood Bank',
    location: 'Downtown District, Sector 4',
    distanceKm: 4.2,
    status: 'Operational',
  },
  {
    id: 'inst-2',
    name: 'St. Jude Memorial Hospital',
    type: 'Trauma Center',
    location: 'Northside Medical Corridor',
    distanceKm: 7.8,
    status: 'High Demand',
  },
  {
    id: 'inst-3',
    name: 'Harborview Medical Center',
    type: 'General Hospital',
    location: 'East Harbor Avenue',
    distanceKm: 11.5,
    status: 'Operational',
  },
  {
    id: 'inst-4',
    name: 'Oakridge Regional Blood Hub',
    type: 'Regional Blood Bank',
    location: 'West Valley Logistics Park',
    distanceKm: 14.1,
    status: 'Operational',
  },
  {
    id: 'inst-5',
    name: 'Mercy General Hospital',
    type: 'General Hospital',
    location: 'Southgate Commons',
    distanceKm: 9.4,
    status: 'Operational',
  },
  {
    id: 'inst-6',
    name: 'Valley Care Medical Institute',
    type: 'Specialty Hospital',
    location: 'Midtown Clinical Campus',
    distanceKm: 6.0,
    status: 'Limited Capacity',
  },
];

const STOCK_MATRIX = {
  'inst-1': { 'O+': 168, 'O-': 52, 'A+': 142, 'A-': 44, 'B+': 96, 'B-': 28, 'AB+': 54, 'AB-': 18 },
  'inst-2': { 'O+': 74,  'O-': 11, 'A+': 68,  'A-': 16, 'B+': 42, 'B-': 9,  'AB+': 24, 'AB-': 6  },
  'inst-3': { 'O+': 92,  'O-': 19, 'A+': 84,  'A-': 22, 'B+': 51, 'B-': 14, 'AB+': 29, 'AB-': 8  },
  'inst-4': { 'O+': 154, 'O-': 46, 'A+': 128, 'A-': 38, 'B+': 88, 'B-': 26, 'AB+': 48, 'AB-': 15 },
  'inst-5': { 'O+': 86,  'O-': 15, 'A+': 79,  'A-': 19, 'B+': 47, 'B-': 11, 'AB+': 26, 'AB-': 7  },
  'inst-6': { 'O+': 58,  'O-': 10, 'A+': 54,  'A-': 13, 'B+': 31, 'B-': 8,  'AB+': 19, 'AB-': 5  },
};

const THRESHOLDS_BY_TYPE = {
  'Regional Blood Bank': { 'O+': 90, 'O-': 35, 'A+': 80, 'A-': 30, 'B+': 55, 'B-': 22, 'AB+': 30, 'AB-': 12 },
  'Trauma Center':       { 'O+': 70, 'O-': 24, 'A+': 60, 'A-': 20, 'B+': 40, 'B-': 16, 'AB+': 22, 'AB-': 10 },
  'General Hospital':    { 'O+': 60, 'O-': 20, 'A+': 55, 'A-': 18, 'B+': 35, 'B-': 14, 'AB+': 20, 'AB-': 9  },
  'Specialty Hospital':  { 'O+': 50, 'O-': 18, 'A+': 45, 'A-': 16, 'B+': 30, 'B-': 12, 'AB+': 18, 'AB-': 8  },
};

export const PRIOR_PERIOD_TOTAL_UNITS = 2244;

export const INITIAL_SAFETY_CONFIG = {
  highRiskBufferDays: 5.0,
  moderateRiskBufferDays: 6.5,
  highRiskCriticalSites: 2,
};

function computeInitialStatus(units, minThreshold) {
  if (units <= Math.round(minThreshold * 0.6)) return 'Critical';
  if (units <= minThreshold) return 'Low';
  return 'Healthy';
}

const baseNow = Date.now();
export const INITIAL_INVENTORY_RECORDS = INSTITUTIONS.flatMap((inst, idx) =>
  BLOOD_GROUPS.map((group) => {
    const units = STOCK_MATRIX[inst.id][group];
    const minThreshold = THRESHOLDS_BY_TYPE[inst.type][group];
    const updatedAt = new Date(baseNow - (idx * 3 + 3) * 60000).toISOString();
    return {
      id: `${inst.id}-${group}`,
      institutionId: inst.id,
      institutionName: inst.name,
      institutionType: inst.type,
      location: inst.location,
      distanceKm: inst.distanceKm,
      bloodGroup: group,
      units,
      minThreshold,
      status: computeInitialStatus(units, minThreshold),
      updatedAt,
    };
  })
);

// Daily baseline consumption per blood group across the 7-day window
const GROUP_DAILY_MATRIX = {
  'O+':  [88, 91, 94, 92, 95, 98, 100],
  'O-':  [27, 29, 30, 31, 32, 34, 34],
  'A+':  [76, 78, 81, 80, 82, 84, 86],
  'A-':  [21, 22, 24, 24, 25, 26, 26],
  'B+':  [45, 47, 48, 47, 49, 50, 50],
  'B-':  [15, 16, 17, 17, 18, 18, 18],
  'AB+': [22, 22, 23, 22, 22, 21, 22],
  'AB-': [10, 10, 11, 11, 11, 12, 12],
};

const GROUP_DAILY_REPLENISH = {
  'O+':  [90, 89, 88, 91, 90, 92, 93],
  'O-':  [26, 27, 26, 28, 27, 28, 28],
  'A+':  [78, 79, 77, 80, 79, 81, 82],
  'A-':  [22, 22, 21, 23, 22, 23, 23],
  'B+':  [46, 46, 45, 47, 46, 48, 48],
  'B-':  [15, 15, 15, 16, 15, 16, 16],
  'AB+': [22, 22, 21, 22, 22, 22, 22],
  'AB-': [10, 10, 10, 11, 10, 11, 11],
};

export const INITIAL_CONSUMPTION_RECORDS = DAYS_ORDER.flatMap((day, dIdx) =>
  BLOOD_GROUPS.map((group, gIdx) => ({
    id: `cons-${day}-${group}`,
    day,
    bloodGroup: group,
    department: DEPARTMENTS[(dIdx + gIdx) % DEPARTMENTS.length],
    unitsConsumed: GROUP_DAILY_MATRIX[group][dIdx],
    unitsReplenished: GROUP_DAILY_REPLENISH[group][dIdx],
    updatedAt: new Date(baseNow - (6 - dIdx) * 86400000).toISOString(),
  }))
);

export const INITIAL_SHORTAGE_REQUESTS = [
  {
    id: 'req-101',
    requestingInstitutionId: 'inst-2',
    requestingInstitutionName: 'St. Jude Memorial Hospital',
    bloodGroup: 'O-',
    requiredUnits: 12,
    urgency: 'Critical',
    notes: 'Stock below minimum stock level (11 / 24 units).',
    status: 'Pending',
    respondedByInstitutionName: 'Metro Central Blood Bank',
    responseNote: 'Awaiting stock verification at Metro Central Blood Bank.',
    createdAt: new Date(baseNow - 24 * 60000).toISOString(),
  },
  {
    id: 'req-102',
    requestingInstitutionId: 'inst-6',
    requestingInstitutionName: 'Valley Care Medical Institute',
    bloodGroup: 'B-',
    requiredUnits: 8,
    urgency: 'High',
    notes: 'Needed for upcoming surgical schedule.',
    status: 'Accepted',
    respondedByInstitutionName: 'Oakridge Regional Blood Hub',
    responseNote: 'Accepted in prototype — pending manual facility verification.',
    createdAt: new Date(baseNow - 52 * 60000).toISOString(),
  },
];

export function createInitialPrototypeState() {
  return {
    inventoryRecords: INITIAL_INVENTORY_RECORDS,
    consumptionRecords: INITIAL_CONSUMPTION_RECORDS,
    safetyConfig: INITIAL_SAFETY_CONFIG,
    shortageRequests: INITIAL_SHORTAGE_REQUESTS,
    acknowledgedAlertIds: [],
  };
}
