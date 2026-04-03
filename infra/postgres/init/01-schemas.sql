-- ──────────────────────────────────────────────────────────────────────────────
-- 01-schemas.sql — Create radius and app schemas
-- Executed automatically by docker-entrypoint-initdb.d on first container start
-- ──────────────────────────────────────────────────────────────────────────────

-- FreeRADIUS schema: radcheck, radreply, radacct, nas, etc.
-- Initialized by 02-radius-schema.sql (never by Alembic — see PITFALLS.md CP-1)
CREATE SCHEMA IF NOT EXISTS radius;

-- Application schema: users, roles, audit_log, etc.
-- All tables created and managed by Alembic migrations
CREATE SCHEMA IF NOT EXISTS app;

-- NOTE (production hardening): In production, create separate DB users:
--   radius_rw: GRANT ALL ON SCHEMA radius (used by FreeRADIUS rlm_sql)
--   app_rw: GRANT ALL ON SCHEMA app, GRANT SELECT ON SCHEMA radius (used by FastAPI)
-- This enforces least-privilege: FreeRADIUS cannot touch app schema, app cannot write radius schema.
-- For Phase 1 dev simplicity, both schemas use the single POSTGRES_USER (superuser).
-- TODO: Implement separate DB users in Phase 4 (production hardening).
