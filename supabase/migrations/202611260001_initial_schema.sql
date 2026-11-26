-- RedSync Stage 1: Initial PostgreSQL / Supabase Schema
-- Creates core tables, constraints, indexes, and enables RLS (default-deny until Stage 2 policies).

create extension if not exists "pgcrypto";

-- Helper trigger function for updated_at timestamps
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Institutions
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (
    type in ('Regional Blood Bank', 'Trauma Center', 'General Hospital', 'Specialty Hospital')
  ),
  location text not null,
  distance_km numeric(6,1) not null default 0 check (distance_km >= 0),
  operational_status text not null default 'Operational' check (
    operational_status in ('Operational', 'High Demand', 'Limited Capacity')
  ),
  approval_status text not null default 'pending' check (
    approval_status in ('pending', 'approved', 'rejected', 'suspended')
  ),
  is_demo boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_institutions_approval_demo
  on public.institutions (approval_status, is_demo);

create trigger trg_institutions_updated_at
  before update on public.institutions
  for each row execute function public.set_updated_at();

-- 2. Profiles (1-to-1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (
    role in ('institution_admin', 'staff', 'network_coordinator', 'demo_user')
  ),
  institution_id uuid references public.institutions(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_profile_institution_binding check (
    (role = 'network_coordinator') or (institution_id is not null) or (role = 'demo_user')
  )
);

create index if not exists idx_profiles_institution_role
  on public.profiles (institution_id, role);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. Blood Inventory
create table if not exists public.blood_inventory (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  blood_group text not null check (
    blood_group in ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
  ),
  units integer not null check (units >= 0),
  min_threshold integer not null check (min_threshold >= 1),
  is_demo boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_inventory_institution_group unique (institution_id, blood_group)
);

create index if not exists idx_blood_inventory_group_demo
  on public.blood_inventory (blood_group, is_demo);

create index if not exists idx_blood_inventory_institution
  on public.blood_inventory (institution_id);

create trigger trg_blood_inventory_updated_at
  before update on public.blood_inventory
  for each row execute function public.set_updated_at();

-- 4. Consumption Logs
create table if not exists public.consumption_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  log_date date not null default current_date,
  blood_group text not null check (
    blood_group in ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
  ),
  department text not null check (
    department in (
      'Emergency & Trauma',
      'Surgical Procedures',
      'Oncology & Hematology',
      'Maternity & NICU',
      'General Inpatient'
    )
  ),
  units_consumed integer not null default 0 check (units_consumed >= 0),
  units_replenished integer not null default 0 check (units_replenished >= 0),
  is_demo boolean not null default false,
  logged_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_consumption_logs_date_group
  on public.consumption_logs (log_date, blood_group, is_demo);

create index if not exists idx_consumption_logs_institution
  on public.consumption_logs (institution_id, log_date);

-- 5. Blood Requests
create table if not exists public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_institution_id uuid not null references public.institutions(id) on delete cascade,
  target_institution_id uuid references public.institutions(id) on delete set null,
  blood_group text not null check (
    blood_group in ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
  ),
  required_units integer not null check (required_units > 0),
  urgency text not null default 'High' check (
    urgency in ('Critical', 'High', 'Moderate')
  ),
  status text not null default 'Pending' check (
    status in ('Pending', 'Accepted', 'Declined', 'Completed')
  ),
  notes text not null default '',
  response_note text not null default '',
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  responded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_request_distinct_institutions check (
    target_institution_id is null or target_institution_id <> requesting_institution_id
  )
);

create index if not exists idx_blood_requests_status_demo
  on public.blood_requests (status, is_demo, created_at desc);

create index if not exists idx_blood_requests_participants
  on public.blood_requests (requesting_institution_id, target_institution_id);

create trigger trg_blood_requests_updated_at
  before update on public.blood_requests
  for each row execute function public.set_updated_at();

-- 6. Safety Configs
create table if not exists public.safety_configs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  high_risk_buffer_days numeric(4,1) not null default 5.0 check (high_risk_buffer_days >= 1.0),
  moderate_risk_buffer_days numeric(4,1) not null default 6.5 check (moderate_risk_buffer_days >= high_risk_buffer_days),
  high_risk_critical_sites integer not null default 2 check (high_risk_critical_sites >= 1),
  is_demo boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_safety_configs_institution
  on public.safety_configs (institution_id, is_demo)
  where institution_id is not null;

create unique index if not exists uq_safety_configs_network_default
  on public.safety_configs (is_demo)
  where institution_id is null;

create trigger trg_safety_configs_updated_at
  before update on public.safety_configs
  for each row execute function public.set_updated_at();

-- 7. Audit Logs (append-only)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  institution_id uuid references public.institutions(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index if not exists idx_audit_logs_institution_time
  on public.audit_logs (institution_id, created_at desc);

-- Enforce Row Level Security on all tables (default-deny until Stage 2 policies are applied)
alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.blood_inventory enable row level security;
alter table public.consumption_logs enable row level security;
alter table public.blood_requests enable row level security;
alter table public.safety_configs enable row level security;
alter table public.audit_logs enable row level security;
