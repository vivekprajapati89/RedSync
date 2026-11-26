#!/usr/bin/env bash
set -euo pipefail

# RedSync Local-Only Network Coordinator Bootstrap Script
# Usage: ./supabase/bootstrap-coordinator.sh <coordinator-email>

if [ $# -ne 1 ]; then
  echo "Usage: $0 <coordinator-email>"
  exit 1
fi

COORD_EMAIL="$1"
DB_CONTAINER="$(docker ps --filter "name=supabase_db_" --format "{{.Names}}" | head -n 1)"

if [ -z "$DB_CONTAINER" ]; then
  echo "Error: Local Supabase PostgreSQL container (supabase_db_*) is not running."
  echo "Start it first with: supabase start"
  exit 1
fi

echo "Promoting '$COORD_EMAIL' to network_coordinator in local container '$DB_CONTAINER'..."

docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -v target_email="$COORD_EMAIL" <<'SQL'
UPDATE public.profiles
SET role = 'network_coordinator',
    institution_id = NULL
WHERE lower(email) = lower(:'target_email')
RETURNING id, full_name, email, role, institution_id, is_active;

SELECT action, entity_type, after_data, created_at
FROM public.audit_logs
WHERE entity_type = 'profiles'
ORDER BY created_at DESC
LIMIT 1;
SQL
