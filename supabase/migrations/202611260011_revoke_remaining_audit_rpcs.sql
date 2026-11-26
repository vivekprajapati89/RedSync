-- RedSync Security Fix 2: Revoke direct RPC EXECUTE privileges on remaining audit trigger functions
-- Preserves SECURITY DEFINER, search_path, triggers, and service_role permissions.

revoke execute on function public.audit_blood_request_changes()
from public, anon, authenticated;

revoke execute on function public.audit_consumption_log_insert()
from public, anon, authenticated;

revoke execute on function public.audit_profile_security_changes()
from public, anon, authenticated;
