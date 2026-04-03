-- ──────────────────────────────────────────────────────────────────────────────
-- 04-app-user.sql — Verify app schema exists (placeholder for Alembic)
-- The app schema was created in 01-schemas.sql.
-- All app.* tables will be created by Alembic migrations (Plan 02).
-- This file confirms the schema is ready and visible.
-- ──────────────────────────────────────────────────────────────────────────────

-- Confirm both schemas exist (visible in init logs)
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('radius', 'app')
ORDER BY schema_name;
