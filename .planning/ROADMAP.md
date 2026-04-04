# Roadmap: Radius UI

## Overview

Radius UI delivers a web-based management interface for FreeRADIUS servers in four phases. Phase 1 establishes the Docker infrastructure, database schemas, and authentication system -- the foundation everything else depends on. Phase 2 builds the core value proposition: full RADIUS user, group, and NAS management with a modern task-oriented UI. Phase 3 adds observability -- dashboards, accounting logs, and active session monitoring -- so administrators can see what is happening on their network. Phase 4 delivers the killer differentiator: multi-server management and audit trail, enabling administrators to control multiple FreeRADIUS instances from a single interface.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Docker infrastructure, dual-schema PostgreSQL, JWT authentication with RBAC
- [ ] **Phase 2: Core RADIUS Management** - User, group, and NAS lifecycle management with task-oriented UI
- [ ] **Phase 3: Observability** - Dashboards, accounting logs, active sessions, and post-auth logs
- [ ] **Phase 4: Multi-Server & Operations** - Multi-server management, service control, and audit trail

## Phase Details

### Phase 1: Foundation
**Goal**: Administrators can launch the entire stack with one command, log in securely, and manage application users with role-based access
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` starts all services (frontend, backend, postgres, 3x freeradius, socket-proxy) and they reach healthy state in correct order
  2. Administrator can log in with email/password and session persists across browser refresh
  3. Super Admin can create application users and assign one of 4 roles (Super Admin, Admin, Operator, Viewer)
  4. Each role has appropriate access restrictions enforced on every API endpoint -- Viewer sees data read-only, Operator cannot manage NAS or server config, Admin cannot manage application users
  5. PostgreSQL contains two isolated schemas (radius and app) and Alembic migrations never touch FreeRADIUS tables
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Docker Compose infrastructure + dual-schema PostgreSQL
- [x] 01-02-PLAN.md — FastAPI backend with JWT auth, RBAC, and Alembic migrations
- [x] 01-03-PLAN.md — Next.js 15 frontend with auth context, middleware, and dashboard shell

### Phase 2: Core RADIUS Management
**Goal**: Administrators can fully manage RADIUS users, groups, NAS devices, and their relationships through an intuitive task-oriented interface
**Depends on**: Phase 1
**Requirements**: USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, USER-07, USER-08, GRP-01, GRP-02, GRP-03, GRP-04, GRP-05, NAS-01, NAS-02, NAS-03, NAS-04, NAS-05, UX-01, UX-02, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. Administrator can create, edit, disable, and delete RADIUS users with correct authentication and reply attributes (radcheck/radreply), and the backend validates RADIUS operators per context
  2. Administrator can create groups, assign users to groups with priority ordering, and view effective policy for any user (merged user + group attributes)
  3. Administrator can manage NAS devices (create, edit, delete, search) with shared secrets masked in UI, and NAS changes trigger a FreeRADIUS restart with user confirmation
  4. All data management uses task-oriented workflows (wizards, not raw table editing), supports sorting/filtering/pagination, and works on tablet-sized screens
  5. Interface is in French by default with dark mode support
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md — FastAPI backend: RADIUS models, schemas with operator validation, service layer, REST endpoints
- [x] 02-02-PLAN.md — Frontend: TypeScript types, API client, Users/Groups/NAS management pages
- [x] 02-03-PLAN.md — UX polish: dark mode, auth history, sessions, effective policy sub-pages

### Phase 3: Observability
**Goal**: Administrators can monitor network activity through dashboards, view accounting records, track active sessions in real-time, and troubleshoot authentication failures
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, LOG-01, LOG-02, LOG-03, LOG-04, LOG-05
**Success Criteria** (what must be TRUE):
  1. Dashboard displays key metrics (total users, active sessions, NAS count, recent auth failures) with selectable time ranges and charts for auth success/failure rates and traffic per NAS
  2. Active sessions count updates in real-time via SSE without manual page refresh
  3. Administrator can browse accounting records and post-auth logs with filtering by user, NAS, date range, and status (Accept/Reject), with server-side pagination for large datasets
  4. Dashboard performance remains fast because metrics use pre-aggregated data (materialized views), never live radacct queries
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Multi-Server & Operations
**Goal**: Administrators can manage multiple FreeRADIUS server instances from a single interface, control services remotely, and review a complete audit trail of all admin actions
**Depends on**: Phase 3
**Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, SRV-06, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04
**Success Criteria** (what must be TRUE):
  1. Administrator can register multiple FreeRADIUS servers and switch between them using a server selector -- all data views (users, groups, NAS, logs, dashboard) scope to the selected server
  2. Administrator can restart or reload a FreeRADIUS server from the UI and view server status (running/stopped, uptime, last restart) and health metrics (CPU, memory)
  3. Every admin action (create, update, delete, restart, reload) is logged with who, what, and when in the app schema
  4. Administrator can view and filter the audit log by user, action type, and date range
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/3 | In Progress|  |
| 2. Core RADIUS Management | 1/3 | In Progress|  |
| 3. Observability | 0/3 | Not started | - |
| 4. Multi-Server & Operations | 0/2 | Not started | - |
