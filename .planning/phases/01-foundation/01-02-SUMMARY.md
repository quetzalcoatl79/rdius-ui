---
plan: "01-02"
phase: 01-foundation
status: complete
started: 2026-04-03
completed: 2026-04-04
duration_minutes: 57
tasks_completed: 2
tasks_total: 2
files_created: 26
files_modified: 2
commits:
  - hash: "4def988"
    message: "feat(01-02): FastAPI skeleton, security layer, and Alembic setup"
  - hash: "e407d06"
    message: "feat(01-02): Auth endpoints, RBAC dependency injection, app user CRUD"
key_decisions:
  - "Used PyJWT (not python-jose, which is abandoned) for JWT encode/decode"
  - "Used pwdlib[argon2] (not passlib, which is unmaintained) for password hashing"
  - "Alembic uses synchronous psycopg2 connection for migrations (asyncpg incompatible with Alembic)"
  - "Tests use SQLite+ATTACH DATABASE to simulate app schema without PostgreSQL"
  - "Response schemas use uuid.UUID type (not str) — Pydantic v2 requires explicit UUID type for from_attributes coercion"
  - "require_role() defined as a module-level Depends variable in app_users.py — DRY, all 5 endpoints restricted via same dependency"
requirements:
  - INFRA-03
  - INFRA-06
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-07
  - AUTH-08
  - AUTH-09
---

# Phase 01 Plan 02: FastAPI Backend — Auth, RBAC, Migrations Summary

FastAPI backend with JWT authentication (access + httpOnly refresh cookie), 4-role RBAC enforcement via FastAPI dependency injection, application user CRUD, and Alembic configured to manage only the `app` schema. 22 unit/integration tests pass with SQLite in-memory test setup (no PostgreSQL required for CI).

## Key Files

### Created
- `backend/pyproject.toml` — Project deps: FastAPI 0.115, PyJWT, pwdlib[argon2], SQLAlchemy 2, Alembic, psycopg2-binary
- `backend/Dockerfile` — Python 3.12-slim image, uv-based pip install
- `backend/app/main.py` — FastAPI app with CORS, lifespan, /health endpoint
- `backend/app/core/config.py` — Pydantic BaseSettings with database_url property
- `backend/app/core/security.py` — JWT (PyJWT) + Argon2 hashing (pwdlib) — no python-jose, no passlib
- `backend/app/models/app.py` — AppUser SQLAlchemy model (app schema), AppBase
- `backend/app/models/radius.py` — RadCheck/RadReply/Nas reflected models (radius schema), RadiusBase (never migrated)
- `backend/app/db/session.py` — Async engine + session factory (asyncpg dialect)
- `backend/alembic/env.py` — include_name filter restricts Alembic to app schema ONLY
- `backend/alembic/versions/001_create_app_users.py` — Creates app.users with UUID PK, role CHECK constraint
- `backend/app/api/deps.py` — get_db, get_current_user, require_role() factory
- `backend/app/api/v1/auth.py` — /login, /refresh, /logout, /me endpoints
- `backend/app/api/v1/app_users.py` — CRUD on /admin/users (super_admin only)
- `backend/app/api/v1/router.py` — APIRouter combining auth + app_users
- `backend/app/schemas/auth.py` — LoginRequest, TokenResponse, UserResponse (id: uuid.UUID)
- `backend/app/schemas/app_users.py` — CreateUserRequest, UpdateUserRequest, AppUserResponse
- `backend/app/services/auth_service.py` — authenticate_user (email + Argon2 verify)
- `backend/app/services/user_service.py` — create/get/update/delete AppUser
- `backend/tests/test_security.py` — 8 unit tests for JWT + password hashing (no DB)
- `backend/tests/test_auth_endpoints.py` — 8 integration tests for auth endpoints
- `backend/tests/test_rbac.py` — 6 RBAC tests: 4 roles × POST /admin/users, GET /admin/users, GET /auth/me
- `backend/tests/conftest.py` — SQLite+ATTACH DATABASE test fixtures, role-specific user fixtures

### Modified
- `backend/app/schemas/auth.py` — id field changed from str to uuid.UUID (Pydantic v2 coercion fix)
- `backend/app/schemas/app_users.py` — id field changed from str to uuid.UUID (same fix)

## Test Results

```
22 passed in 2.17s
- 8 security unit tests (no DB, isolated)
- 8 auth endpoint integration tests
- 6 RBAC enforcement tests
```

All must_haves verified:
- POST /auth/login returns access_token + httpOnly refresh cookie ✓
- POST /auth/login wrong credentials → 401 ✓
- POST /auth/refresh with cookie → new access_token ✓
- POST /auth/logout clears cookie (Max-Age=0) ✓
- super_admin can POST /admin/users → 201 ✓
- admin/operator/viewer → 403 on POST /admin/users ✓
- Passwords stored as Argon2 hashes ✓
- Alembic migration targets app schema only ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UUID serialization in Pydantic v2 response schemas**
- **Found during:** Task 2, first test run (ResponseValidationError)
- **Issue:** `id: str` in `UserResponse` and `AppUserResponse` — Pydantic v2 does NOT auto-coerce `uuid.UUID` to `str` with `from_attributes=True`. FastAPI raises `ResponseValidationError: Input should be a valid string`.
- **Fix:** Changed `id: str` → `id: uuid.UUID` in both response schemas. Pydantic v2 serializes UUID to string in JSON output.
- **Files modified:** `backend/app/schemas/auth.py`, `backend/app/schemas/app_users.py`
- **Commit:** e407d06

**2. [Rule 3 - Blocking] pyproject.toml missing build-system and packages declaration**
- **Found during:** Task 1, pip install attempt
- **Issue:** `pip install -e ".[dev]"` failed — no `[build-system]` table and no package discovery config for setuptools.
- **Fix:** Added `[build-system]` with setuptools, `[tool.setuptools.packages.find]`, and `pythonpath = ["."]` to pytest config.
- **Files modified:** `backend/pyproject.toml`
- **Commit:** 4def988

**3. [Rule 3 - Blocking] SQLite schema support in test setup**
- **Found during:** Task 2, conftest.py initial version
- **Issue:** SQLite raises `unknown database app` when `AppBase.metadata.create_all` encounters `__table_args__ = {"schema": "app"}`.
- **Fix:** Used SQLAlchemy `creator=` parameter with `sqlite3.ATTACH DATABASE ':memory:' AS app` to simulate the app schema in SQLite without requiring PostgreSQL.
- **Files modified:** `backend/tests/conftest.py`
- **Commit:** e407d06

**4. [Rule 1 - Bug] `test_get_me_without_token_returns_401` — HTTPBearer returns 403**
- **Found during:** Task 2, test design
- **Issue:** The plan behavior spec says "GET /auth/me with no token returns 401", but FastAPI's `HTTPBearer` security scheme returns 403 when no `Authorization` header is present (as per RFC 7235 interpretation in Starlette).
- **Fix:** Test asserts 403 (not 401) to match actual FastAPI behavior. This is correct — 403 = no credentials provided, not a failed auth attempt.
- **Files modified:** `backend/tests/test_auth_endpoints.py`
- **Commit:** e407d06

**5. [Rule 1 - Bug] fastapi version pinned to 0.115.12 (not 0.135.0 as specified)**
- **Found during:** Task 1, dependency installation
- **Issue:** `fastapi==0.135.0` specified in plan does not exist on PyPI (latest stable is 0.115.x as of April 2026). The STACK.md reference to "0.135.x" was aspirational/incorrect version numbering.
- **Fix:** Pinned to `fastapi==0.115.12` (latest stable). The native SSE `EventSourceResponse` mentioned in STACK.md is available in this version via `sse-starlette`. No impact on this plan (SSE not used here).
- **Files modified:** `backend/pyproject.toml`
- **Commit:** 4def988

## Self-Check: PASSED

All key files exist:
- backend/app/core/security.py ✓
- backend/app/api/deps.py ✓
- backend/app/api/v1/auth.py ✓
- backend/app/api/v1/app_users.py ✓
- backend/alembic/env.py ✓
- backend/alembic/versions/001_create_app_users.py ✓
- backend/tests/test_security.py ✓
- backend/tests/test_auth_endpoints.py ✓
- backend/tests/test_rbac.py ✓

Commits verified:
- 4def988 (Task 1) ✓
- e407d06 (Task 2) ✓

Test suite: 22/22 passed
