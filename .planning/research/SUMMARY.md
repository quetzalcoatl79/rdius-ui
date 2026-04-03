# Project Research Summary

**Project:** Radius UI -- FreeRADIUS Management Web Application
**Domain:** Network infrastructure management (RADIUS AAA)
**Researched:** 2026-04-03
**Confidence:** HIGH

## Executive Summary

Radius UI is an on-premise web management interface for FreeRADIUS 3.2.x servers, targeting network administrators who currently rely on CLI tools or outdated PHP interfaces (daloRADIUS, dialup-admin). The market is fragmented: existing tools are either abandoned, technically outdated, or lack multi-server support. No competitor offers the combination of multi-server management, modern UX, configuration file editing, and comprehensive monitoring that Radius UI targets. The recommended approach is a decoupled architecture: Next.js 15 frontend consuming a FastAPI backend, with PostgreSQL shared between the application and FreeRADIUS via a dual-schema design. FreeRADIUS runs in Docker containers controlled by the backend through a Docker socket proxy.

The core architectural challenge is that FreeRADIUS and the application share a database but must not interfere with each other. SQL-based data (users, groups, NAS) is immediately visible to FreeRADIUS on every auth request, requiring no restart. File-based configuration (modules, EAP, virtual servers) requires SIGHUP or full restart depending on the module. NAS client changes specifically require a full restart, not just a HUP signal -- a subtle but critical distinction that every prior management tool has gotten wrong at some point. The dual-schema approach (separate `radius` and `app` PostgreSQL schemas with Alembic managing only the `app` schema) is the foundation that prevents the single most dangerous class of bugs: accidental migration of FreeRADIUS tables.

The key risks are: (1) RADIUS operator misuse in radcheck/radreply inserts causing silent authentication failures, (2) Docker socket exposure granting root-equivalent host access if the backend is compromised, (3) the known HUP memory leak in FreeRADIUS 3.2.x causing OOM kills under frequent reloads, and (4) unbounded radacct table growth degrading both FreeRADIUS and dashboard performance. All four have well-documented prevention strategies that must be implemented from Phase 1. The technology stack is fully specified with high confidence -- no major stack decisions remain open.

## Key Findings

### Recommended Stack

The stack is pre-decided and well-validated. All major choices have HIGH confidence with verified version compatibility. The frontend uses Next.js 15.5.x (App Router, React 19, Server Components), Tailwind CSS 4.x (CSS-first config), and shadcn/ui CLI v4 (Radix UI primitives). The backend uses Python 3.12 with FastAPI 0.135.x (native SSE support), SQLAlchemy 2.0 async with asyncpg, and Alembic for migrations. See `.planning/research/STACK.md` for complete version matrix and installation commands.

**Core technologies:**
- **Next.js 15 + React 19**: SSR, Server Components for data-heavy admin pages, App Router for nested layouts
- **Tailwind CSS 4 + shadcn/ui**: Utility-first CSS with accessible component primitives, OKLCH colors, no JS config needed
- **FastAPI 0.135.x**: Async API framework with auto-generated OpenAPI docs, native SSE, dependency injection for RBAC
- **SQLAlchemy 2.0 + asyncpg**: Async ORM for dual-schema database access, 5x faster than psycopg3 for async
- **PostgreSQL 16**: Shared between FreeRADIUS (radius schema) and application (app schema)
- **Docker Compose**: 6+ services (frontend, backend, postgres, 3x freeradius, socket-proxy)
- **TanStack Query 5.x**: Server state management with caching, background refresh, optimistic mutations
- **Recharts 3.8.x**: Declarative React charting for dashboards
- **PyJWT**: JWT handling (replaces abandoned python-jose)
- **pwdlib[argon2]**: Password hashing (replaces unmaintained passlib)

**Critical version notes:**
- Do NOT use Next.js 16 (removes sync request API compatibility)
- Do NOT use python-jose or passlib (both abandoned)
- Tailwind v4 uses CSS-first config (@theme) -- no tailwind.config.js
- FastAPI 0.135+ has built-in SSE, eliminating the need for sse-starlette

### Expected Features

Research identified 11 table-stakes features, 13 differentiators, and 12 anti-features. The competitive analysis covers 5 existing tools (daloRADIUS, RadMan, RADIUSdesk, OpenWISP, dialup-admin). See `.planning/research/FEATURES.md` for the full competitor matrix and dependency graph.

**Must have (table stakes -- P0):**
- Authentication with RBAC (Super Admin, Admin, Operator, Viewer)
- User CRUD (radcheck + radreply, with correct operator semantics)
- Group CRUD (radgroupcheck + radgroupreply)
- User-Group assignment (radusergroup with priority)
- NAS management (with secret protection and restart workflow)
- Search, filtering, and server-side pagination
- Modern, responsive UI (baked into every component, not a separate phase)

**Should have (differentiators -- P1/P2):**
- Accounting data viewer and active sessions (P1 -- daily operations)
- Post-auth log viewer (P1 -- troubleshooting)
- Basic and rich statistics dashboard with Recharts (P1)
- Multi-server management (P2 -- the killer differentiator, no competitor has this)
- Service control via Docker API (P2)
- Audit trail (P2 -- compliance)
- Server health monitoring (P2)

**Defer (P3 / v2+):**
- Configuration file management (P3 -- high risk, high value, needs guardrails)
- Bulk operations / CSV import-export (P3)
- CoA / Disconnect messages (P3 -- requires RADIUS client implementation)
- Connectivity testing (P3 -- built-in radtest equivalent)
- Attribute templates, NAS groups, policy visualization (P3)
- Billing, GIS maps, self-registration, LDAP browser, multi-tenant SaaS (NEVER for v1)

### Architecture Approach

The system follows a strict layered architecture: the Next.js frontend is a pure API consumer that never accesses the database or Docker directly. The FastAPI backend is the single orchestration point for all operations -- SQL writes, config file management, container lifecycle, and RBAC enforcement. FreeRADIUS instances are independent RADIUS servers sharing one PostgreSQL database, with per-instance config volumes controlled by the backend through a Docker socket proxy. See `.planning/research/ARCHITECTURE.md` for the complete system diagram, project structure, data flows, and code patterns.

**Major components:**
1. **Next.js Frontend** -- UI rendering, SSR, routing. JWT access token in memory, refresh token in httpOnly cookie. Route groups: `(auth)` and `(dashboard)`. Server Components for data pages, Client Components only for interactivity.
2. **FastAPI Backend** -- Authentication, authorization, RADIUS CRUD with operator semantics, config file management, Docker container control, SSE streaming. Service layer pattern encapsulates multi-table RADIUS operations.
3. **PostgreSQL 16** -- Dual-schema design: `radius.*` (FreeRADIUS tables, initialized from official schema.sql, NEVER by Alembic) and `app.*` (application tables, managed by Alembic). Separate DB users per schema.
4. **FreeRADIUS 3.2.x Containers** -- Independent RADIUS servers, SQL mode with PostgreSQL, per-instance config volumes. Discovered via Docker labels.
5. **Docker Socket Proxy** -- Restricted proxy that only allows container restart/kill signals for labeled containers. Mandatory security layer between backend and Docker daemon.

**Key architectural patterns:**
- Server-scoped API routes: all RADIUS endpoints prefixed with `/servers/{server_id}/`
- Service layer for RADIUS operations (single method call = multi-table transaction with correct operators)
- SSE for real-time dashboard updates (not WebSocket, not polling)
- Pre-aggregated dashboard metrics (never query radacct directly from dashboard endpoints)
- Atomic config file writes with backup-validate-apply workflow

### Critical Pitfalls

Research identified 7 critical pitfalls, 3 technical debt patterns, 4 integration gotchas, 3 performance traps, 3 security mistakes, and 3 UX pitfalls. Each is mapped to a specific phase. See `.planning/research/PITFALLS.md` for the complete reference with prevention code examples.

**Top pitfalls by impact:**

1. **CP-1: Schema ownership conflict** -- Alembic autogenerate can modify or drop FreeRADIUS tables, silently breaking all authentication. Prevention: dual-schema design with Alembic `include_name` filter targeting only the `app` schema. Must be correct from Phase 1.

2. **CP-2: RADIUS operator misuse** -- Wrong operators in radcheck/radreply cause silent auth failures (e.g., `==` instead of `:=` for Cleartext-Password). Prevention: backend validation layer with context-aware operator defaults, UI dropdown with only valid operators per table/attribute. The most common bug in every FreeRADIUS UI ever built.

3. **CP-4: Docker socket = root access** -- Unrestricted socket mount means a compromised backend owns the host. Prevention: mandatory Docker socket proxy (Tecnativa/docker-socket-proxy) from day one, restricted to restart/kill on labeled containers only.

4. **CP-5: HUP memory leak** -- Confirmed bug in FreeRADIUS 3.2.x (issue #5490). Repeated HUP signals leak memory until OOM kill. Prevention: batch config changes, prefer full restart over HUP, monitor container memory, set memory limits.

5. **TD-1: radacct unbounded growth** -- Without partitioning, radacct reaches millions of rows in months, degrading both FreeRADIUS performance and dashboard queries. Prevention: PostgreSQL table partitioning by month from day one using pg_partman, plus materialized views for dashboard queries.

## Implications for Roadmap

Based on combined research from all four files, the following phase structure respects dependency ordering, groups related features, and maps pitfalls to the phases where they must be addressed.

### Phase 1: Foundation (Infrastructure + Auth)
**Rationale:** Everything depends on the database schema, Docker infrastructure, and authentication. Getting these wrong poisons all subsequent phases. The dual-schema design, socket proxy, and JWT/RBAC implementation are non-negotiable foundations.
**Delivers:** Docker Compose with all 6+ services running, dual-schema PostgreSQL initialized, FastAPI skeleton with JWT auth + RBAC, Next.js shell with login flow.
**Features:** TS-8 (Auth + RBAC), infrastructure setup
**Avoids:** CP-1 (schema ownership), CP-4 (Docker socket exposure), SM-1 (JWT algorithm confusion), SM-2 (RBAC bypass), TD-1 (radacct partitioning -- set up from day one), IG-1 (column name case folding)

### Phase 2: Core RADIUS Management (CRUD + NAS)
**Rationale:** User/Group/NAS management is the primary reason admins want this tool. The RADIUS operator semantics and NAS restart workflow must be built correctly from the start -- these are the most common source of bugs in every FreeRADIUS management UI.
**Delivers:** Full CRUD for RADIUS users, groups, user-group assignment, and NAS devices. Task-oriented UX (not raw table editing). Search, filtering, pagination.
**Features:** TS-1 (Users), TS-2 (Groups), TS-3 (User-Group), TS-4 (NAS), TS-10 (Search), TS-11 (Pagination), D-2 (Modern UI)
**Avoids:** CP-2 (operator misuse), CP-3 (NAS restart requirement), CP-6 (secret exposure), CP-7 (cleartext passwords), UX-1 (exposing RADIUS internals), TD-2 (attribute hardcoding), PT-2 (N+1 queries), IG-2 (Simultaneous-Use config)

### Phase 3: Observability (Logs + Dashboard + Sessions)
**Rationale:** Once admins can manage users and NAS devices, they need to see what is happening: who is connected, why authentication failed, what the traffic patterns look like. The dashboard data pipeline must be designed before the UI to avoid performance pitfalls.
**Delivers:** Accounting viewer, active sessions (with SSE), post-auth log viewer, basic dashboard with key metrics, rich statistics with Recharts charts.
**Features:** TS-5 (Accounting), TS-6 (Active Sessions), TS-7 (Post-auth Logs), TS-9 (Basic Dashboard), D-3 (Rich Stats)
**Avoids:** PT-1 (dashboard queries hitting live tables), UX-3 (metric overload)

### Phase 4: Multi-Server + Operations
**Rationale:** This is the differentiator that makes Radius UI unique. It depends on the CRUD and observability layers being solid. Multi-server adds the server selector, per-server dashboards, and service control capabilities.
**Delivers:** Server registry, server selector in UI, per-server data scoping, service control (restart/reload/status), server health monitoring, audit trail logging.
**Features:** D-1 (Multi-server), D-4 (Service Control), D-10 (Health Monitoring), D-6 (Audit Trail)
**Avoids:** CP-5 (HUP memory leak -- batch reloads, prefer restart), PT-3 (aggressive health polling)

### Phase 5: Advanced Operations
**Rationale:** Power features for experienced admins. Config file management is the highest-risk feature in the entire product and needs the most guardrails (backup, validate, diff, rollback). CoA/Disconnect and connectivity testing require RADIUS client protocol implementation.
**Delivers:** Configuration file editor with validation, bulk operations (CSV import/export), CoA/Disconnect messages, connectivity testing, attribute templates, NAS groups, policy visualization.
**Features:** D-5 (Config File Mgmt), D-7 (Bulk Ops), D-8 (CoA/Disconnect), D-12 (Connectivity Test), D-9 (Templates), D-11 (NAS Groups), D-13 (Policy Visualization)
**Avoids:** TD-3 (config without validation), IG-3 (multi-server config race conditions), SM-3 (certificate file permissions)

### Phase Ordering Rationale

- **Phase 1 before everything:** The dual-schema database design, Docker socket proxy, and auth/RBAC are load-bearing infrastructure. A mistake here corrupts every subsequent phase. CP-1 (schema ownership) alone justifies treating Phase 1 as the highest-priority foundation.
- **Phase 2 before Phase 3:** Dashboard metrics are meaningless without users, groups, and NAS devices. Active sessions require accounting data which requires functioning RADIUS authentication, which requires correct user/NAS setup.
- **Phase 3 before Phase 4:** Multi-server management extends the observability layer (per-server dashboards, per-server sessions). Building the single-server observability first, then generalizing to multi-server, avoids over-engineering the data pipeline.
- **Phase 4 before Phase 5:** Config file management and service control belong together (edit config then restart), but service control is a prerequisite for config management. Phase 4 builds the Docker integration; Phase 5 adds the file management on top.
- **Modern UI (D-2) is not a phase:** It is a quality bar applied to every phase. shadcn/ui, Tailwind, dark mode, keyboard shortcuts -- these are built into every component from Phase 2 onward.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2 (RADIUS CRUD):** RADIUS operator semantics are complex and domain-specific. The operator validation layer and dictionary parser need careful design. Research the FreeRADIUS dictionary file format and build a complete operator-to-context mapping before writing CRUD endpoints.
- **Phase 4 (Multi-server):** The server-scoped API pattern is well-defined, but the Docker label-based discovery and socket proxy configuration need testing with the actual Docker Compose setup. Research Tecnativa/docker-socket-proxy configuration options.
- **Phase 5 (Config Management):** FreeRADIUS config file syntax is custom (not JSON, not YAML). No readily available parser exists. Research `radiusd -XC` validation behavior, atomic file write patterns on Docker volumes, and whether structured form editing is feasible for common modules (EAP, SQL).

**Phases with standard patterns (skip deep research):**
- **Phase 1 (Foundation):** JWT auth, RBAC, dual-schema PostgreSQL, Alembic configuration, Docker Compose setup -- all well-documented with established patterns.
- **Phase 3 (Observability):** Recharts dashboards, SSE streaming, SQL aggregation queries, materialized views -- standard web development patterns. The pre-aggregation strategy is the key design decision, not a research question.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies pre-specified in PROJECT.md. Versions verified against official docs and registries. No open decisions. |
| Features | HIGH | Competitor analysis covers 5 tools with feature-by-feature matrix. Feature dependencies mapped. Priorities grounded in market gap analysis. |
| Architecture | HIGH | Dual-schema pattern verified against FreeRADIUS official schema.sql, SQLAlchemy multi-schema docs, and Alembic filter documentation. Docker socket proxy pattern from OWASP. |
| Pitfalls | HIGH | Critical pitfalls verified against FreeRADIUS GitHub issues (#5490 memory leak, #5628 performance), official operator wiki, OWASP Docker security. Operator semantics cross-checked with FreeRADIUS SQL HOWTO. |

**Overall confidence:** HIGH

### Gaps to Address

- **FreeRADIUS dictionary parser implementation:** No off-the-shelf Python library parses FreeRADIUS dictionary files. The dictionary format is documented but a parser must be written from scratch. Validate the approach during Phase 2 planning.
- **Dynamic NAS clients vs restart:** FreeRADIUS 3.2.x supports `dynamic_clients` via virtual server lookup to avoid restarts on NAS changes. Evaluate whether this is worth the per-request overhead vs the restart approach. Decision needed before Phase 2 NAS implementation.
- **Redis for token revocation:** STACK.md recommends Redis (MEDIUM confidence). For v1 with few admin users, a PostgreSQL-backed token blacklist may be sufficient. Decide during Phase 1 planning.
- **PostgreSQL LISTEN/NOTIFY for real-time:** Architecture suggests LISTEN/NOTIFY as an alternative to polling radacct for live session updates. This is more efficient but adds complexity. Decide during Phase 3 planning whether SSE+polling is sufficient.
- **Graceful restart behavior:** Docker restart sends SIGTERM then SIGKILL. Verify that FreeRADIUS 3.2.x handles graceful shutdown correctly (completes in-flight auth requests before stopping). Test during Phase 4.
- **Certificate file permissions in Docker volumes:** The backend writes certs but FreeRADIUS requires specific UID/GID ownership. Docker volume mount behavior for file permissions needs testing. Address during Phase 5.
- **FreeRADIUS Docker image selection:** The official `freeradius/freeradius-server` Docker Hub tags are unclear (3.0.x vs 3.2.x). May need to build a custom image from the 3.2.x branch. Validate during Phase 1.
- **Postgres schema initialization order:** Docker Compose startup order matters. PostgreSQL must be ready, schema.sql must run before FreeRADIUS starts, and Alembic migrations must run before the backend starts. Needs startup orchestration (health checks or init script).

## Sources

### Primary (HIGH confidence)
- [FreeRADIUS PostgreSQL Schema (v3.2.x)](https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-config/sql/main/postgresql/schema.sql) -- Table definitions, column names, default operators
- [FreeRADIUS Operators Wiki](https://wiki.freeradius.org/config/Operators) -- Operator semantics for check vs reply items
- [FreeRADIUS SQL HOWTO](https://wiki.freeradius.org/guide/SQL-HOWTO) -- SQL mode configuration patterns
- [FastAPI docs (v0.135.x)](https://fastapi.tiangolo.com/) -- Native SSE, PyJWT recommendation, dependency injection
- [Next.js 15 docs](https://nextjs.org/docs/app/guides/upgrading/version-15) -- App Router, Server Components, project structure
- [Alembic autogenerate docs](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) -- include_object, include_name, schema filtering
- [Docker Security OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) -- Socket proxy recommendation
- [FreeRADIUS HUP Memory Leak -- Issue #5490](https://github.com/FreeRADIUS/freeradius-server/issues/5490) -- Confirmed bug
- [FreeRADIUS PostgreSQL Performance -- Issue #5628](https://github.com/FreeRADIUS/freeradius-server/issues/5628) -- radacct growth thresholds

### Secondary (MEDIUM confidence)
- [daloRADIUS GitHub](https://github.com/lirantal/daloradius) -- Competitor feature analysis, known issues
- [OpenWISP RADIUS GitHub](https://github.com/openwisp/openwisp-radius) -- Competitor feature analysis, REST API patterns
- [Tecnativa docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) -- Socket proxy implementation
- [InkBridge Networks: FreeRADIUS performance](https://www.inkbridgenetworks.com/blog/blog-10/my-freeradius-server-is-slow-what-s-wrong-97) -- Database performance thresholds
- [CloudRADIUS FreeRADIUS GUI article](https://cloudradius.com/is-there-a-freeradius-gui/) -- Market gap analysis
- [asyncpg vs psycopg3 comparison](https://fernandoarteaga.dev/blog/psycopg-vs-asyncpg/) -- Driver performance benchmarks

### Tertiary (LOW confidence)
- [FreeRADIUS mailing list: NAS from DB](https://freeradius-users.freeradius.narkive.com/arkSZbSE/nas-from-db-add-without-restart) -- Dynamic clients discussion (needs validation)
- [FreeRADIUS SIGHUP behavior](https://lists.freeradius.org/pipermail/freeradius-users/2018-March/091126.html) -- HUP vs restart module list (older thread, verify against current version)

---
*Research completed: 2026-04-03*
*Ready for roadmap: yes*
