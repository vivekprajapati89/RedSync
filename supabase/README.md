# RedSync Supabase Database Foundation (Stage 1)

This directory contains the PostgreSQL / Supabase database foundation for **RedSync**.

> **Status:** Stage 1 (Schema & Isolated Demo Seed) only. These files have **not** been applied to a live database, and the React frontend remains on local prototype storage (`src/services/storage.js`).

## Files

- `migrations/202611260001_initial_schema.sql` — Creates the 7 core tables (`institutions`, `profiles`, `blood_inventory`, `consumption_logs`, `blood_requests`, `safety_configs`, `audit_logs`), primary/foreign keys, check/unique constraints, `updated_at` triggers, indexes, and enables Row Level Security (RLS) on every table.
- `seed.sql` — Idempotent fictional demo dataset (`is_demo = true`) matching `src/data/mockData.js` (6 fictional facilities, 48 inventory rows totaling 2,202 units, 56 7-day consumption logs, 1 network safety config, and 2 sample requests). No `auth.users` or passwords are seeded.

## Security & RLS Status

- **RLS Enabled:** `ENABLE ROW LEVEL SECURITY` is active on all 7 tables.
- **Default-Deny:** No permissive RLS policies are defined in Stage 1, so all client access is denied by default until Stage 3 policies and helper functions are added.
- **Demo Separation:** Every domain table includes `is_demo boolean not null default false` to strictly isolate demo/prototype records from real institutional data.

## Pending Stages

- **Stage 2:** Supabase client setup & authentication/institution registration/approval workflow.
- **Stage 3:** Role-based RLS policies, `SECURITY DEFINER` role/approval helpers (with `SET search_path = public`), `audit_logs` triggers, and the atomic `complete_blood_request` transfer RPC.
- **Stage 4:** Frontend data service cutover and Supabase Realtime subscriptions.
