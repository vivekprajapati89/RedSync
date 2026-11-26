# Local-Only Coordinator Bootstrap Procedure

RedSync **never** auto-assigns `network_coordinator` during signup, and `profiles.role` cannot be changed from the client (`protect_profile_privileged_fields` trigger blocks all client role/institution edits).

## Step-by-Step Setup

1. **Create a separate auth account** in the RedSync **Create Account** screen using a dedicated coordinator email (do **not** register an institution for this account, and do **not** reuse a hospital staff email).
2. **Promote the account locally** using the helper script (requires local Docker + `supabase start`):
   ```bash
   ./supabase/bootstrap-coordinator.sh <coordinator-email@example.com>
   ```
   *(This sets `role = 'network_coordinator'` and `institution_id = NULL` in `public.profiles`, and records a `profile_security_updated` event in `public.audit_logs`.)*
3. **Sign in** to RedSync at `http://localhost:5173/` with that coordinator email and password. You will automatically see the **Coordinator Approval** view (`CoordinatorApprovalView`), where you can inspect pending registrations, approve/reject/suspend/restore institutions, and review audit logs.

> **Security Note:** Never run this against a remote database without formal change control, and never commit coordinator credentials or emails to Git.
