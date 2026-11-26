-- RedSync Stage 1: Isolated Demo / Prototype Seed Data
-- All rows in this file are explicitly marked with is_demo = true.
-- They represent fictional facilities and simulated inventory from src/data/mockData.js.

-- 1. Fictional Demo Institutions (6 facilities)
insert into public.institutions (id, name, type, location, distance_km, operational_status, approval_status, is_demo)
values
  ('11111111-1111-4111-8111-000000000001', 'Metro Central Blood Bank (Demo)', 'Regional Blood Bank', 'Downtown District, Sector 4', 4.2, 'Operational', 'approved', true),
  ('11111111-1111-4111-8111-000000000002', 'St. Jude Memorial Hospital (Demo)', 'Trauma Center', 'Northside Medical Corridor', 7.8, 'High Demand', 'approved', true),
  ('11111111-1111-4111-8111-000000000003', 'Harborview Medical Center (Demo)', 'General Hospital', 'East Harbor Avenue', 11.5, 'Operational', 'approved', true),
  ('11111111-1111-4111-8111-000000000004', 'Oakridge Regional Blood Hub (Demo)', 'Regional Blood Bank', 'West Valley Logistics Park', 14.1, 'Operational', 'approved', true),
  ('11111111-1111-4111-8111-000000000005', 'Mercy General Hospital (Demo)', 'General Hospital', 'Southgate Commons', 9.4, 'Operational', 'approved', true),
  ('11111111-1111-4111-8111-000000000006', 'Valley Care Medical Institute (Demo)', 'Specialty Hospital', 'Midtown Clinical Campus', 6.0, 'Limited Capacity', 'approved', true)
on conflict (id) do nothing;

-- 2. Demo Blood Inventory (48 records, 2,202 total units)
insert into public.blood_inventory (institution_id, blood_group, units, min_threshold, is_demo)
values
  -- Metro Central Blood Bank (602 units)
  ('11111111-1111-4111-8111-000000000001', 'O+', 168, 90, true),
  ('11111111-1111-4111-8111-000000000001', 'O-', 52,  35, true),
  ('11111111-1111-4111-8111-000000000001', 'A+', 142, 80, true),
  ('11111111-1111-4111-8111-000000000001', 'A-', 44,  30, true),
  ('11111111-1111-4111-8111-000000000001', 'B+', 96,  55, true),
  ('11111111-1111-4111-8111-000000000001', 'B-', 28,  22, true),
  ('11111111-1111-4111-8111-000000000001', 'AB+', 54, 30, true),
  ('11111111-1111-4111-8111-000000000001', 'AB-', 18, 12, true),

  -- St. Jude Memorial Hospital (250 units)
  ('11111111-1111-4111-8111-000000000002', 'O+', 74,  70, true),
  ('11111111-1111-4111-8111-000000000002', 'O-', 11,  24, true),
  ('11111111-1111-4111-8111-000000000002', 'A+', 68,  60, true),
  ('11111111-1111-4111-8111-000000000002', 'A-', 16,  20, true),
  ('11111111-1111-4111-8111-000000000002', 'B+', 42,  40, true),
  ('11111111-1111-4111-8111-000000000002', 'B-', 9,   16, true),
  ('11111111-1111-4111-8111-000000000002', 'AB+', 24, 22, true),
  ('11111111-1111-4111-8111-000000000002', 'AB-', 6,  10, true),

  -- Harborview Medical Center (319 units)
  ('11111111-1111-4111-8111-000000000003', 'O+', 92,  60, true),
  ('11111111-1111-4111-8111-000000000003', 'O-', 19,  20, true),
  ('11111111-1111-4111-8111-000000000003', 'A+', 84,  55, true),
  ('11111111-1111-4111-8111-000000000003', 'A-', 22,  18, true),
  ('11111111-1111-4111-8111-000000000003', 'B+', 51,  35, true),
  ('11111111-1111-4111-8111-000000000003', 'B-', 14,  14, true),
  ('11111111-1111-4111-8111-000000000003', 'AB+', 29, 20, true),
  ('11111111-1111-4111-8111-000000000003', 'AB-', 8,  9,  true),

  -- Oakridge Regional Blood Hub (543 units)
  ('11111111-1111-4111-8111-000000000004', 'O+', 154, 90, true),
  ('11111111-1111-4111-8111-000000000004', 'O-', 46,  35, true),
  ('11111111-1111-4111-8111-000000000004', 'A+', 128, 80, true),
  ('11111111-1111-4111-8111-000000000004', 'A-', 38,  30, true),
  ('11111111-1111-4111-8111-000000000004', 'B+', 88,  55, true),
  ('11111111-1111-4111-8111-000000000004', 'B-', 26,  22, true),
  ('11111111-1111-4111-8111-000000000004', 'AB+', 48, 30, true),
  ('11111111-1111-4111-8111-000000000004', 'AB-', 15, 12, true),

  -- Mercy General Hospital (290 units)
  ('11111111-1111-4111-8111-000000000005', 'O+', 86,  60, true),
  ('11111111-1111-4111-8111-000000000005', 'O-', 15,  20, true),
  ('11111111-1111-4111-8111-000000000005', 'A+', 79,  55, true),
  ('11111111-1111-4111-8111-000000000005', 'A-', 19,  18, true),
  ('11111111-1111-4111-8111-000000000005', 'B+', 47,  35, true),
  ('11111111-1111-4111-8111-000000000005', 'B-', 11,  14, true),
  ('11111111-1111-4111-8111-000000000005', 'AB+', 26, 20, true),
  ('11111111-1111-4111-8111-000000000005', 'AB-', 7,  9,  true),

  -- Valley Care Medical Institute (198 units)
  ('11111111-1111-4111-8111-000000000006', 'O+', 58,  50, true),
  ('11111111-1111-4111-8111-000000000006', 'O-', 10,  18, true),
  ('11111111-1111-4111-8111-000000000006', 'A+', 54,  45, true),
  ('11111111-1111-4111-8111-000000000006', 'A-', 13,  16, true),
  ('11111111-1111-4111-8111-000000000006', 'B+', 31,  30, true),
  ('11111111-1111-4111-8111-000000000006', 'B-', 8,   12, true),
  ('11111111-1111-4111-8111-000000000006', 'AB+', 19, 18, true),
  ('11111111-1111-4111-8111-000000000006', 'AB-', 5,  8,  true)
on conflict (institution_id, blood_group) do nothing;

-- 3. Demo Safety Config
insert into public.safety_configs (id, institution_id, high_risk_buffer_days, moderate_risk_buffer_days, high_risk_critical_sites, is_demo)
values
  ('22222222-2222-4222-8222-000000000001', null, 5.0, 6.5, 2, true)
on conflict (id) do nothing;

-- 4. Demo 7-Day Consumption Logs (attributed to Metro Central demo hub for aggregate trend seeding)
insert into public.consumption_logs (id, institution_id, log_date, blood_group, department, units_consumed, units_replenished, is_demo)
values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000001', current_date - 6, 'O+',  'Emergency & Trauma',    88, 90, true),
  ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-000000000001', current_date - 6, 'O-',  'Surgical Procedures',   27, 26, true),
  ('44444444-4444-4444-8444-000000000003', '11111111-1111-4111-8111-000000000001', current_date - 6, 'A+',  'Oncology & Hematology', 76, 78, true),
  ('44444444-4444-4444-8444-000000000004', '11111111-1111-4111-8111-000000000001', current_date - 6, 'A-',  'Maternity & NICU',      21, 22, true),
  ('44444444-4444-4444-8444-000000000005', '11111111-1111-4111-8111-000000000001', current_date - 6, 'B+',  'General Inpatient',     45, 46, true),
  ('44444444-4444-4444-8444-000000000006', '11111111-1111-4111-8111-000000000001', current_date - 6, 'B-',  'Emergency & Trauma',    15, 15, true),
  ('44444444-4444-4444-8444-000000000007', '11111111-1111-4111-8111-000000000001', current_date - 6, 'AB+', 'Surgical Procedures',   22, 22, true),
  ('44444444-4444-4444-8444-000000000008', '11111111-1111-4111-8111-000000000001', current_date - 6, 'AB-', 'Oncology & Hematology', 10, 10, true),

  ('44444444-4444-4444-8444-000000000009', '11111111-1111-4111-8111-000000000001', current_date - 5, 'O+',  'Surgical Procedures',   91, 89, true),
  ('44444444-4444-4444-8444-000000000010', '11111111-1111-4111-8111-000000000001', current_date - 5, 'O-',  'Emergency & Trauma',    29, 27, true),
  ('44444444-4444-4444-8444-000000000011', '11111111-1111-4111-8111-000000000001', current_date - 5, 'A+',  'Maternity & NICU',      78, 79, true),
  ('44444444-4444-4444-8444-000000000012', '11111111-1111-4111-8111-000000000001', current_date - 5, 'A-',  'General Inpatient',     22, 22, true),
  ('44444444-4444-4444-8444-000000000013', '11111111-1111-4111-8111-000000000001', current_date - 5, 'B+',  'Oncology & Hematology', 47, 46, true),
  ('44444444-4444-4444-8444-000000000014', '11111111-1111-4111-8111-000000000001', current_date - 5, 'B-',  'Surgical Procedures',   16, 15, true),
  ('44444444-4444-4444-8444-000000000015', '11111111-1111-4111-8111-000000000001', current_date - 5, 'AB+', 'Emergency & Trauma',    22, 22, true),
  ('44444444-4444-4444-8444-000000000016', '11111111-1111-4111-8111-000000000001', current_date - 5, 'AB-', 'Maternity & NICU',      10, 10, true),

  ('44444444-4444-4444-8444-000000000017', '11111111-1111-4111-8111-000000000001', current_date - 4, 'O+',  'Oncology & Hematology', 94, 88, true),
  ('44444444-4444-4444-8444-000000000018', '11111111-1111-4111-8111-000000000001', current_date - 4, 'O-',  'Emergency & Trauma',    30, 26, true),
  ('44444444-4444-4444-8444-000000000019', '11111111-1111-4111-8111-000000000001', current_date - 4, 'A+',  'Surgical Procedures',   81, 77, true),
  ('44444444-4444-4444-8444-000000000020', '11111111-1111-4111-8111-000000000001', current_date - 4, 'A-',  'Oncology & Hematology', 24, 21, true),
  ('44444444-4444-4444-8444-000000000021', '11111111-1111-4111-8111-000000000001', current_date - 4, 'B+',  'Maternity & NICU',      48, 45, true),
  ('44444444-4444-4444-8444-000000000022', '11111111-1111-4111-8111-000000000001', current_date - 4, 'B-',  'General Inpatient',     17, 15, true),
  ('44444444-4444-4444-8444-000000000023', '11111111-1111-4111-8111-000000000001', current_date - 4, 'AB+', 'Oncology & Hematology', 23, 21, true),
  ('44444444-4444-4444-8444-000000000024', '11111111-1111-4111-8111-000000000001', current_date - 4, 'AB-', 'General Inpatient',     11, 10, true),

  ('44444444-4444-4444-8444-000000000025', '11111111-1111-4111-8111-000000000001', current_date - 3, 'O+',  'Emergency & Trauma',    92, 91, true),
  ('44444444-4444-4444-8444-000000000026', '11111111-1111-4111-8111-000000000001', current_date - 3, 'O-',  'Surgical Procedures',   31, 28, true),
  ('44444444-4444-4444-8444-000000000027', '11111111-1111-4111-8111-000000000001', current_date - 3, 'A+',  'Emergency & Trauma',    80, 80, true),
  ('44444444-4444-4444-8444-000000000028', '11111111-1111-4111-8111-000000000001', current_date - 3, 'A-',  'Surgical Procedures',   24, 23, true),
  ('44444444-4444-4444-8444-000000000029', '11111111-1111-4111-8111-000000000001', current_date - 3, 'B+',  'Emergency & Trauma',    47, 47, true),
  ('44444444-4444-4444-8444-000000000030', '11111111-1111-4111-8111-000000000001', current_date - 3, 'B-',  'Oncology & Hematology', 17, 16, true),
  ('44444444-4444-4444-8444-000000000031', '11111111-1111-4111-8111-000000000001', current_date - 3, 'AB+', 'Maternity & NICU',      22, 22, true),
  ('44444444-4444-4444-8444-000000000032', '11111111-1111-4111-8111-000000000001', current_date - 3, 'AB-', 'Emergency & Trauma',    11, 11, true),

  ('44444444-4444-4444-8444-000000000033', '11111111-1111-4111-8111-000000000001', current_date - 2, 'O+',  'Surgical Procedures',   95, 90, true),
  ('44444444-4444-4444-8444-000000000034', '11111111-1111-4111-8111-000000000001', current_date - 2, 'O-',  'Emergency & Trauma',    32, 27, true),
  ('44444444-4444-4444-8444-000000000035', '11111111-1111-4111-8111-000000000001', current_date - 2, 'A+',  'Oncology & Hematology', 82, 79, true),
  ('44444444-4444-4444-8444-000000000036', '11111111-1111-4111-8111-000000000001', current_date - 2, 'A-',  'Maternity & NICU',      25, 22, true),
  ('44444444-4444-4444-8444-000000000037', '11111111-1111-4111-8111-000000000001', current_date - 2, 'B+',  'Surgical Procedures',   49, 46, true),
  ('44444444-4444-4444-8444-000000000038', '11111111-1111-4111-8111-000000000001', current_date - 2, 'B-',  'Emergency & Trauma',    18, 15, true),
  ('44444444-4444-4444-8444-000000000039', '11111111-1111-4111-8111-000000000001', current_date - 2, 'AB+', 'General Inpatient',     22, 22, true),
  ('44444444-4444-4444-8444-000000000040', '11111111-1111-4111-8111-000000000001', current_date - 2, 'AB-', 'Surgical Procedures',   11, 10, true),

  ('44444444-4444-4444-8444-000000000041', '11111111-1111-4111-8111-000000000001', current_date - 1, 'O+',  'Emergency & Trauma',    98, 92, true),
  ('44444444-4444-4444-8444-000000000042', '11111111-1111-4111-8111-000000000001', current_date - 1, 'O-',  'Emergency & Trauma',    34, 28, true),
  ('44444444-4444-4444-8444-000000000043', '11111111-1111-4111-8111-000000000001', current_date - 1, 'A+',  'Surgical Procedures',   84, 81, true),
  ('44444444-4444-4444-8444-000000000044', '11111111-1111-4111-8111-000000000001', current_date - 1, 'A-',  'Emergency & Trauma',    26, 23, true),
  ('44444444-4444-4444-8444-000000000045', '11111111-1111-4111-8111-000000000001', current_date - 1, 'B+',  'Oncology & Hematology', 50, 48, true),
  ('44444444-4444-4444-8444-000000000046', '11111111-1111-4111-8111-000000000001', current_date - 1, 'B-',  'Surgical Procedures',   18, 16, true),
  ('44444444-4444-4444-8444-000000000047', '11111111-1111-4111-8111-000000000001', current_date - 1, 'AB+', 'Oncology & Hematology', 21, 22, true),
  ('44444444-4444-4444-8444-000000000048', '11111111-1111-4111-8111-000000000001', current_date - 1, 'AB-', 'Emergency & Trauma',    12, 11, true),

  ('44444444-4444-4444-8444-000000000049', '11111111-1111-4111-8111-000000000001', current_date,     'O+',  'Emergency & Trauma',    100, 93, true),
  ('44444444-4444-4444-8444-000000000050', '11111111-1111-4111-8111-000000000001', current_date,     'O-',  'Surgical Procedures',   34,  28, true),
  ('44444444-4444-4444-8444-000000000051', '11111111-1111-4111-8111-000000000001', current_date,     'A+',  'Surgical Procedures',   86,  82, true),
  ('44444444-4444-4444-8444-000000000052', '11111111-1111-4111-8111-000000000001', current_date,     'A-',  'Oncology & Hematology', 26,  23, true),
  ('44444444-4444-4444-8444-000000000053', '11111111-1111-4111-8111-000000000001', current_date,     'B+',  'Maternity & NICU',      50,  48, true),
  ('44444444-4444-4444-8444-000000000054', '11111111-1111-4111-8111-000000000001', current_date,     'B-',  'Emergency & Trauma',    18,  16, true),
  ('44444444-4444-4444-8444-000000000055', '11111111-1111-4111-8111-000000000001', current_date,     'AB+', 'Surgical Procedures',   22,  22, true),
  ('44444444-4444-4444-8444-000000000056', '11111111-1111-4111-8111-000000000001', current_date,     'AB-', 'Maternity & NICU',      12,  11, true)
on conflict (id) do nothing;

-- 5. Demo Blood Requests (2 sample simulated requests)
insert into public.blood_requests (id, requesting_institution_id, target_institution_id, blood_group, required_units, urgency, status, notes, response_note, is_demo)
values
  (
    '33333333-3333-4333-8333-000000000101',
    '11111111-1111-4111-8111-000000000002',
    '11111111-1111-4111-8111-000000000001',
    'O-',
    12,
    'Critical',
    'Pending',
    'Demo request: stock below minimum stock level (11 / 24 units).',
    'Awaiting simulated verification at Metro Central Blood Bank (Demo).',
    true
  ),
  (
    '33333333-3333-4333-8333-000000000102',
    '11111111-1111-4111-8111-000000000006',
    '11111111-1111-4111-8111-000000000004',
    'B-',
    8,
    'High',
    'Accepted',
    'Demo request: needed for upcoming surgical schedule.',
    'Accepted in demo — pending manual facility verification.',
    true
  )
on conflict (id) do nothing;
