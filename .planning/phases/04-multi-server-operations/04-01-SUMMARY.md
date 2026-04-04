---
phase: 04-multi-server-operations
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, alembic, docker, audit, postgresql, jsonb]

requires:
  - phase: 01-foundation
    provides: AppUser model, AppBase declarative base, JWT auth deps (require_role, get_db)
  - phase: 02-core-radius-management
    provides: PaginatedResponse generic schema, static service method pattern

provides:
  - Alembic migration 002 for app.servers and app.audit_log tables
  - Server and AuditLog SQLAlchemy models (appended to app/models/app.py)
  - Pydantic schemas for server CRUD and Docker status/health
  - DockerService: container restart/status/health via socket proxy
  - AuditService: transactional audit log writes
  - ServerService: server CRUD + paginated audit log queries
  - REST API at /api/v1/servers (CRUD + restart + status + health)
  - REST API at /api/v1/audit (paginated, filterable audit trail)

affects: [04-02-frontend-multi-server]

tech-stack:
  added: []
  patterns:
    - Static-method service classes (DockerService, AuditService, ServerService)
    - AuditService.log() called before db.commit() so audit and data are in the same transaction
    - DockerService calls socket proxy with stream=false for stats (PT-3 mitigation)
    - Container restart uses t=10 for graceful shutdown (CP-5 mitigation)

key-files:
  created:
    - backend/alembic/versions/002_add_servers_and_audit_log.py
    - backend/app/schemas/server.py
    - backend/app/schemas/audit.py
    - backend/app/services/docker_service.py
    - backend/app/services/audit_service.py
    - backend/app/services/server_service.py
    - backend/app/api/v1/servers.py
    - backend/app/api/v1/audit.py
  modified:
    - backend/app/models/app.py
    - backend/app/api/v1/router.py

key-decisions:
  - "AuditService.log() uses db.flush() not db.commit() — audit entry and data mutation commit together in one transaction"
  - "DockerService identifies containers by radius-ui.instance label (not container name) — matches docker-compose.yml label pattern"
  - "Container restart uses ?t=10 parameter for 10s graceful shutdown before SIGKILL"
  - "Docker stats endpoint called with stream=false to get single snapshot (avoids open streaming connections)"
  - "Audit log stores user_email as denormalized field for fast display without joins"

patterns-established:
  - "DockerService: static methods, httpx with timeout, HTTPException(503) on httpx errors"
  - "AuditService: db.add() + db.flush() within caller transaction, never db.commit()"
  - "Server endpoints: look up server first, return 404 if not found, then perform action"

requirements-completed: [SRV-01, SRV-03, SRV-04, SRV-05, SRV-06, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04]

duration: 4min
completed: 2026-04-04
---

# Phase 04 Plan 01: Multi-Server Operations Backend Summary

**FastAPI backend for multi-server registry and audit trail: CRUD for server registrations, Docker container control via socket proxy, and transactional audit logging for every admin action**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T22:45:27Z
- **Completed:** 2026-04-04T22:49:09Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Migration 002 creates app.servers and app.audit_log tables with indexes on user_id, action, created_at
- DockerService routes container restart/status/health through the tecnativa socket proxy with t=10 graceful shutdown
- AuditService writes to audit_log in the same transaction as the triggering mutation (flush before commit)
- ServerService provides full CRUD for server registry and paginated audit log queries
- 8 REST endpoints at /api/v1/servers (CRUD + restart + status + health) and 1 at /api/v1/audit

## Task Commits

1. **Task 1: Database models, schemas, and Alembic migration** - `5a835e3` (feat)
2. **Task 2: Docker service, audit service, server CRUD service** - `e171f30` (feat)
3. **Task 3: API endpoints for servers and audit, wire into router** - `9200151` (feat)

## Files Created/Modified

- `backend/alembic/versions/002_add_servers_and_audit_log.py` - Migration for app.servers + app.audit_log with 3 indexes
- `backend/app/models/app.py` - Added Server and AuditLog SQLAlchemy models (appended)
- `backend/app/schemas/server.py` - ServerCreate, ServerUpdate, ServerResponse, ServerStatus, ServerHealth
- `backend/app/schemas/audit.py` - AuditLogResponse, AuditLogFilter
- `backend/app/services/docker_service.py` - Container lookup/restart/status/health via socket proxy
- `backend/app/services/audit_service.py` - Transactional audit log writing
- `backend/app/services/server_service.py` - Server CRUD + paginated audit log queries
- `backend/app/api/v1/servers.py` - 8 endpoints: CRUD + restart + status + health
- `backend/app/api/v1/audit.py` - 1 endpoint: GET / with filters
- `backend/app/api/v1/router.py` - Added servers and audit sub-routers

## Decisions Made

- AuditService uses `db.flush()` (not `db.commit()`) so audit entries are always in the same transaction as the triggering data change. This prevents orphaned audit entries on rollback.
- DockerService identifies containers via `radius-ui.instance={docker_container_id}` label filter, matching the label set in docker-compose.yml (not container name which can change).
- Container restart uses `?t=10` to allow FreeRADIUS 10 seconds for graceful shutdown before SIGKILL (CP-5 mitigation from plan).
- Docker stats called with `?stream=false` to get a single snapshot instead of an open stream (PT-3 mitigation).
- `user_email` is stored denormalized in audit_log so display queries don't require a JOIN to app.users.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration 002 runs automatically via `alembic upgrade head`.

## Next Phase Readiness

- All /api/v1/servers and /api/v1/audit endpoints are ready for Plan 04-02 frontend consumption
- DockerService is fully integrated; the NasService ad-hoc httpx calls remain for backward compat (not superseded yet)
- Frontend (Plan 04-02) can consume: GET /servers (list), POST /servers (create), POST /servers/{id}/restart (control), GET /servers/{id}/status (status), GET /servers/{id}/health (metrics), GET /audit (trail)

---
*Phase: 04-multi-server-operations*
*Completed: 2026-04-04*
