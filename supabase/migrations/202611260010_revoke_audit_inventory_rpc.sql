-- RedSync Security Fix: Revoke direct RPC EXECUTE privileges on trigger function audit_blood_inventory_changes()
-- Trigger execution by PostgreSQL (trg_audit_blood_inventory_changes) is unaffected.

revoke execute on function public.audit_blood_inventory_changes() from public, anon, authenticated;
