---
phase: 03-observability
plan: "01"
subsystem: backend-observability
tags: [dashboard, logs, sse, materialized-views, fastapi, sqlalchemy]
dependency_graph:
  requires:
    - 02-01 (RadAcct, RadPostAuth, Nas, RadCheck models)
    - 02-01 (AsyncSession, PaginatedResponse, require_role patterns)
    - 01-01 (JWT/security, verify_token)
  provides:
    - DashboardService (metrics, auth rates, traffic, top users, SSE count, view refresh)
    - LogService (accounting, active sessions, postauth with pagination+filters)
    - 8 REST endpoints + 1 SSE endpoint under /api/v1/dashboard/* and /api/v1/logs/*
    - PostgreSQL materialized views SQL (mv_auth_rates, mv_traffic_per_nas, mv_top_users)
  affects:
    - backend/app/main.py (lifespan now starts background refresh task)
    - backend/app/api/v1/router.py (two new sub-routers)
tech_stack:
  added: []
  patterns:
    - "SSE via StreamingResponse with media_type=text/event-stream (no sse-starlette needed)"
    - "SSE token auth via query param (EventSource API cannot set headers)"
    - "Background asyncio.create_task in lifespan for periodic view refresh"
    - "Raw SQL text() for materialized view queries (not mapped as ORM models)"
    - "Explicit primary key IDs in SQLite test fixtures (BigInteger + RETURNING quirk)"
key_files:
  created:
    - backend/sql/materialized_views.sql
    - backend/app/schemas/dashboard.py
    - backend/app/schemas/logs.py
    - backend/app/services/dashboard_service.py
    - backend/app/services/log_service.py
    - backend/app/api/v1/dashboard.py
    - backend/app/api/v1/logs.py
    - backend/tests/test_dashboard.py
    - backend/tests/test_logs.py
  modified:
    - backend/app/core/config.py (added materialized_view_refresh_seconds)
    - backend/app/api/v1/router.py (added dashboard and logs routers)
    - backend/app/main.py (added _refresh_views_loop + lifespan management)
decisions:
  - "SSE token auth via query param: EventSource API cannot set Authorization headers, validated inline before opening stream"
  - "Materialized view methods (get_auth_rates, get_traffic_per_nas, get_top_users) use raw text() SQL — views are not SQLAlchemy ORM models"
  - "Test coverage for materialized view endpoints deferred to PostgreSQL integration tests — SQLite does not support CREATE MATERIALIZED VIEW"
  - "Explicit primary key IDs in all SQLite test fixtures for BigInteger PKs: SQLite does not support RETURNING on BigInteger columns (autoincrement quirk)"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_created: 9
  files_modified: 3
---

# Phase 03 Plan 01: Backend Observability Layer Summary

**One-liner:** Dashboard metrics + log APIs backed by PostgreSQL materialized views with SSE active-session streaming and 60s background refresh.

## What Was Built

### Materialized Views (DASH-06)
`backend/sql/materialized_views.sql` defines 3 PostgreSQL materialized views with unique indexes for `REFRESH CONCURRENTLY`:
- `radius.mv_auth_rates`: hourly success/failure counts from radpostauth (last 30 days)
- `radius.mv_traffic_per_nas`: bytes in/out per NAS from radacct (last 30 days)
- `radius.mv_top_users`: total bytes + session time per user from radacct (last 30 days)

### Dashboard Service + Schemas
`DashboardService` provides 6 static async methods:
- `get_metrics(db)`: 4 live queries (radcheck, radacct, nas, radpostauth) — returns `DashboardMetrics`
- `get_auth_rates(db, range)`: queries `mv_auth_rates` for time-bucketed data
- `get_traffic_per_nas(db)`: queries `mv_traffic_per_nas`
- `get_top_users(db, by, limit)`: queries `mv_top_users`
- `get_active_session_count(db)`: live count for SSE endpoint
- `refresh_materialized_views(db)`: `REFRESH MATERIALIZED VIEW CONCURRENTLY` for all 3 views

### Log Service + Schemas
`LogService` provides 3 static async methods with full filter + pagination:
- `get_accounting(db, username, nas_ip, date_from, date_to, page, page_size)` — LOG-01/04/05
- `get_active_sessions(db, page, page_size)` — LOG-02/05 (AcctStopTime IS NULL only)
- `get_postauth(db, username, status, date_from, date_to, page, page_size)` — LOG-03/05 (status: "accept"/"reject" mapped to reply column values)

### API Routes
5 dashboard endpoints (`/api/v1/dashboard/`):
- `GET /metrics` — DashboardMetrics (DASH-01)
- `GET /auth-rates?range=24h` — list[AuthRateBucket] (DASH-02)
- `GET /traffic-per-nas` — list[TrafficPerNas] (DASH-04)
- `GET /top-users?by=traffic&limit=10` — list[TopUser] (DASH-05)
- `GET /sessions/stream?token=xxx` — SSE StreamingResponse, active_sessions every 5s (DASH-03)

3 log endpoints (`/api/v1/logs/`):
- `GET /accounting` — PaginatedResponse[AccountingRecord]
- `GET /sessions` — PaginatedResponse[ActiveSession]
- `GET /postauth` — PaginatedResponse[PostAuthRecord]

All endpoints require `viewer+` RBAC role.

### Background Refresh Task
`_refresh_views_loop()` in `main.py` lifespan: `asyncio.create_task` at startup, `cancel()` at shutdown. Refreshes all 3 views every `settings.materialized_view_refresh_seconds` (default 60).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `da9ac25` | Materialized views SQL, schemas, services, tests (21 tests) |
| Task 2 | `779000f` | Dashboard/log routes, SSE endpoint, background refresh, router wiring |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLite BigInteger PK RETURNING clause incompatibility**
- **Found during:** Task 1, GREEN phase test execution
- **Issue:** SQLite raises `NOT NULL constraint failed` when inserting `RadAcct` and `RadPostAuth` rows without explicit PKs — SQLite does not support the PostgreSQL-style `RETURNING "RadAcctId"` clause on BigInteger columns with `autoincrement=True`
- **Fix:** Added explicit `radacctid` and `id` values to all test fixture inserts; added `_acct_id_counter` and `_postauth_id_counter` module-level counters + helper functions `_make_acct()` and `_make_postauth()` for clean test data creation
- **Files modified:** `backend/tests/test_dashboard.py`, `backend/tests/test_logs.py`
- **Commit:** `da9ac25`

## Known Stubs

- `framedipaddress` is always `None` in `AccountingRecord` and `ActiveSession` responses — the current `RadAcct` ORM model does not map the `FramedIPAddress` column. This field is present in the FreeRADIUS schema but was not included in Phase 2's model definition. Future: add `framedipaddress = Column("FramedIPAddress", Text, nullable=True)` to the `RadAcct` model when needed by the frontend.

## Self-Check: PASSED

All 7 created files exist on disk. Both commits (da9ac25, 779000f) verified in git log.
100/100 tests pass (79 existing + 21 new).
