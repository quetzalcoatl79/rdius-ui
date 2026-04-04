# Requirements: Radius UI

**Defined:** 2026-04-03
**Core Value:** Network administrators can fully configure and monitor one or more FreeRADIUS servers without ever touching the CLI or editing configuration files.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Docker Compose runs all services (frontend, backend, postgres, 3x freeradius, socket-proxy) with a single `docker compose up`
- [ ] **INFRA-02**: PostgreSQL uses dual-schema design: `radius` schema (FreeRADIUS tables) and `app` schema (application tables)
- [x] **INFRA-03**: Alembic migrations only touch `app` schema — never modify FreeRADIUS tables
- [ ] **INFRA-04**: Docker socket proxy restricts API to restart/kill signals on labeled FreeRADIUS containers only
- [ ] **INFRA-05**: radacct table is partitioned by month from day one (pg_partman)
- [x] **INFRA-06**: Service startup orchestration ensures correct order: postgres → schema init → freeradius → backend → frontend

### Authentication & Authorization

- [x] **AUTH-01**: User can log in with email and password
- [x] **AUTH-02**: User session persists across browser refresh (JWT access token in memory + refresh token in httpOnly cookie)
- [x] **AUTH-03**: User can log out from any page
- [x] **AUTH-04**: Super Admin can create/edit/delete application users and assign roles
- [x] **AUTH-05**: RBAC enforced on every API endpoint with 4 roles: Super Admin, Admin, Operator, Viewer
- [x] **AUTH-06**: Viewer has read-only access to dashboards and data
- [x] **AUTH-07**: Operator can manage RADIUS users/groups but not NAS or server config
- [x] **AUTH-08**: Admin has full access except application user management and server infrastructure
- [x] **AUTH-09**: Password stored with Argon2 hashing (pwdlib)

### RADIUS User Management

- [x] **USER-01**: Admin can create a RADIUS user with password and authentication attributes (radcheck)
- [x] **USER-02**: Admin can set reply attributes for a user (VLAN, IP, bandwidth limits via radreply)
- [x] **USER-03**: Admin can edit and delete RADIUS users
- [x] **USER-04**: Admin can search users by username with instant filtering
- [x] **USER-05**: Admin can view a user's authentication history (from radpostauth)
- [x] **USER-06**: Admin can view a user's session history (from radacct)
- [x] **USER-07**: Admin can enable/disable a user without deleting them
- [x] **USER-08**: Backend validates RADIUS operators per table/attribute context (`:=` vs `==` vs `+=`)

### Group Management

- [x] **GRP-01**: Admin can create RADIUS groups with check and reply attributes
- [x] **GRP-02**: Admin can assign users to groups with priority ordering (radusergroup)
- [x] **GRP-03**: Admin can edit and delete groups
- [x] **GRP-04**: Admin can view all members of a group
- [x] **GRP-05**: Admin can view effective policy for a user (merged user + group attributes with priority)

### NAS Management

- [x] **NAS-01**: Admin can create NAS devices with IP, shared secret, type, and description
- [x] **NAS-02**: Admin can edit and delete NAS devices
- [x] **NAS-03**: Shared secrets are masked in the UI (show/hide toggle) and never logged
- [x] **NAS-04**: After NAS changes, the system triggers a FreeRADIUS restart (not just reload) with user confirmation
- [x] **NAS-05**: Admin can search NAS devices by name, IP, or type

### Monitoring & Dashboards

- [ ] **DASH-01**: Dashboard shows key metrics: total users, active sessions, NAS count, recent auth failures
- [ ] **DASH-02**: Dashboard shows auth success/failure rate chart over selectable time ranges (1h, 24h, 7d, 30d)
- [ ] **DASH-03**: Dashboard shows active sessions count with real-time updates (SSE)
- [ ] **DASH-04**: Dashboard shows traffic per NAS (bandwidth in/out) as bar or line chart
- [ ] **DASH-05**: Dashboard shows top users by traffic or session time
- [ ] **DASH-06**: Dashboard metrics use pre-aggregated data (materialized views), not live radacct queries

### Logs & Accounting

- [ ] **LOG-01**: Admin can view accounting records (radacct) with filtering by user, NAS, date range
- [ ] **LOG-02**: Admin can view active sessions (radacct where AcctStopTime IS NULL) with live refresh
- [ ] **LOG-03**: Admin can view post-auth logs (radpostauth) filtered by status (Accept/Reject) and date
- [ ] **LOG-04**: Session data shows: username, NAS, IP, duration, data in/out, termination cause
- [ ] **LOG-05**: All log views support server-side pagination for large datasets

### Multi-Server Management

- [ ] **SRV-01**: Admin can register multiple FreeRADIUS server instances in the application
- [ ] **SRV-02**: UI shows a server selector to switch context between servers
- [ ] **SRV-03**: All RADIUS data views (users, groups, NAS, logs, dashboard) are scoped to the selected server
- [ ] **SRV-04**: Admin can restart or reload a FreeRADIUS server from the UI via Docker API
- [ ] **SRV-05**: Admin can view server status (running/stopped, uptime, last restart)
- [ ] **SRV-06**: Admin can view server health metrics (CPU, memory via Docker stats)

### Audit Trail

- [ ] **AUDIT-01**: Every admin action (create, update, delete) is logged with who, what, when
- [ ] **AUDIT-02**: Audit log is stored in app schema (separate from FreeRADIUS tables)
- [ ] **AUDIT-03**: Admin can view and filter audit logs by user, action type, date range
- [ ] **AUDIT-04**: Service control actions (restart, reload) are logged in audit trail

### UI/UX

- [x] **UX-01**: Interface uses task-oriented workflows (e.g., "Add user" wizard) not raw table editing
- [x] **UX-02**: Interface is responsive (works on tablet for field technicians)
- [x] **UX-03**: Dark mode support
- [x] **UX-04**: Interface is in French by default (code and commits in English)
- [x] **UX-05**: All data tables support sorting, filtering, and server-side pagination

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Configuration

- **CFG-01**: Admin can view and edit FreeRADIUS module configurations through structured forms
- **CFG-02**: Admin can manage EAP settings and TLS certificates
- **CFG-03**: Admin can enable/disable FreeRADIUS modules (symlink management)
- **CFG-04**: Config changes validated via `radiusd -C` before applying
- **CFG-05**: Config file backup and diff view before applying changes

### Bulk Operations

- **BULK-01**: Admin can import users from CSV with preview/validation
- **BULK-02**: Admin can export users/groups to CSV
- **BULK-03**: Admin can batch assign users to groups
- **BULK-04**: Admin can batch update attributes across users

### Advanced Features

- **ADV-01**: Admin can send CoA/Disconnect messages to NAS devices
- **ADV-02**: Admin can test RADIUS connectivity (built-in radtest equivalent)
- **ADV-03**: Admin can create attribute templates for common user profiles
- **ADV-04**: Admin can manage NAS groups (radhuntgroup)
- **ADV-05**: Policy visualization showing effective attributes with conflict highlighting
- **ADV-06**: Internationalization (English, other languages)
- **ADV-07**: Multi-tenant SaaS mode (shared platform, tenant isolation)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Billing / payment engine | Separate domain; target users don't bill through RADIUS. Expose accounting data via API instead. |
| GIS / map view | Requires GPS data admins rarely have. Enterprise use case doesn't need maps. |
| User self-registration portal | For ISPs/captive portals, not enterprise 802.1X. Build separately if needed. |
| Real-time packet capture / debug mode | Dangerous: restarts RADIUS in debug mode. Admins use SSH + `radiusd -X`. |
| LDAP/AD directory browser | Conflates RADIUS and directory management. Out of scope per PROJECT.md. |
| Custom dictionary editor | High risk of bricking server. Standard dictionaries sufficient. |
| Social login (Google, etc.) | Irrelevant for enterprise RADIUS. |
| FreeRADIUS v4.x support | v4 still alpha. Target v3.2.x only. |
| Raw text editor without guardrails | Syntax errors brick the server. Use structured forms + validation. |
| In-browser terminal / SSH | Security nightmare. Use Docker API for service control. |
| Auto-provisioning new servers | Infrastructure concern, not management UI scope. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| AUTH-08 | Phase 1 | Complete |
| AUTH-09 | Phase 1 | Complete |
| USER-01 | Phase 2 | Complete |
| USER-02 | Phase 2 | Complete |
| USER-03 | Phase 2 | Complete |
| USER-04 | Phase 2 | Complete |
| USER-05 | Phase 2 | Complete |
| USER-06 | Phase 2 | Complete |
| USER-07 | Phase 2 | Complete |
| USER-08 | Phase 2 | Complete |
| GRP-01 | Phase 2 | Complete |
| GRP-02 | Phase 2 | Complete |
| GRP-03 | Phase 2 | Complete |
| GRP-04 | Phase 2 | Complete |
| GRP-05 | Phase 2 | Complete |
| NAS-01 | Phase 2 | Complete |
| NAS-02 | Phase 2 | Complete |
| NAS-03 | Phase 2 | Complete |
| NAS-04 | Phase 2 | Complete |
| NAS-05 | Phase 2 | Complete |
| UX-01 | Phase 2 | Complete |
| UX-02 | Phase 2 | Complete |
| UX-03 | Phase 2 | Complete |
| UX-04 | Phase 2 | Complete |
| UX-05 | Phase 2 | Complete |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Pending |
| DASH-06 | Phase 3 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| LOG-03 | Phase 3 | Pending |
| LOG-04 | Phase 3 | Pending |
| LOG-05 | Phase 3 | Pending |
| SRV-01 | Phase 4 | Pending |
| SRV-02 | Phase 4 | Pending |
| SRV-03 | Phase 4 | Pending |
| SRV-04 | Phase 4 | Pending |
| SRV-05 | Phase 4 | Pending |
| SRV-06 | Phase 4 | Pending |
| AUDIT-01 | Phase 4 | Pending |
| AUDIT-02 | Phase 4 | Pending |
| AUDIT-03 | Phase 4 | Pending |
| AUDIT-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 59 total
- Mapped to phases: 59
- Unmapped: 0

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation*
