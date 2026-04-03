# Radius UI

## What This Is

A web-based management interface for FreeRADIUS servers, designed as a product for network administrators. It replaces CLI-based FreeRADIUS configuration with an intuitive visual interface that supports managing multiple FreeRADIUS instances simultaneously or independently — like configuring RADIUS servers across train WiFi sites from a single dashboard.

## Core Value

Network administrators can fully configure and monitor one or more FreeRADIUS servers without ever touching the CLI or editing configuration files.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-server FreeRADIUS management from a single interface
- [ ] Full RADIUS user/group/NAS lifecycle management via SQL
- [ ] JWT authentication with RBAC (Super Admin, Admin, Operator, Viewer)
- [ ] Real-time dashboards: active sessions, auth stats, traffic per NAS
- [ ] Complete FreeRADIUS configuration: modules, EAP, certificates, policies, virtual servers, proxy
- [ ] Audit trail and log management (auth logs, accounting, admin actions)
- [ ] Fully containerized deployment (Docker Compose per client instance)
- [ ] Server health monitoring and service control (restart, reload)

### Out of Scope

- Multi-tenant SaaS platform — v1 is single-instance per client, multi-tenant deferred to v2
- Mobile native app — web-first, responsive design sufficient for v1
- FreeRADIUS v4.x support — v4 is still alpha, target v3.2.x only
- LDAP/Active Directory integration in UI — can be configured manually, UI support deferred
- Billing/subscription management — not relevant for v1 on-premise deployment
- Real-time packet capture/debug — too complex for v1, use `radiusd -X` via CLI

## Context

- **Product type**: On-premise product deployed per client (dedicated Docker Compose instance)
- **Target users**: Network administrators managing RADIUS infrastructure (e.g., train WiFi, campus networks, enterprise 802.1X)
- **FreeRADIUS version**: 3.2.x (stable, production-ready)
- **Architecture**: FreeRADIUS configured in SQL mode — the UI reads/writes the same PostgreSQL tables FreeRADIUS uses (radcheck, radreply, radgroupcheck, radgroupreply, radusergroup, radacct, radpostauth, nas)
- **Multi-server**: 3 FreeRADIUS instances in dev/demo to simulate multi-site deployment (e.g., different geographic locations)
- **Config management**: SQL for users/groups/NAS (direct table writes), filesystem for modules/policies/virtual servers (shared volumes + HUP reload)
- **Existing tools in market**: daloRADIUS (PHP, outdated UI), RadMan (Java, limited), dialup-admin (legacy) — all lack modern UX and multi-server support

## Constraints

- **Tech stack (frontend)**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui — modern, maintainable, SSR-capable
- **Tech stack (backend)**: Python FastAPI + SQLAlchemy + Alembic — async, auto-documented API, rich ecosystem
- **Tech stack (database)**: PostgreSQL 16 — shared between app and FreeRADIUS
- **Tech stack (charts)**: Recharts — React-native charting library
- **Containerization**: Docker Compose with 6 services (frontend, backend, postgres, 3x freeradius)
- **Security**: JWT + bcrypt, RBAC on every endpoint, shared secrets never exposed to frontend
- **Language**: UI in French (default) with English code/commits. Internationalization deferred to v2

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| FastAPI over Go | Faster development, richer ecosystem for RADIUS/SQL/Docker, sufficient performance for admin UI | — Pending |
| SQL mode over flat files | UI writes directly to DB that FreeRADIUS reads, no file parsing needed for users/groups/NAS | — Pending |
| Instance per client over multi-tenant | Simpler architecture, better isolation, lower risk for v1 | — Pending |
| shadcn/ui over custom components | Consistent design system, accessible, customizable, fast to build | — Pending |
| FreeRADIUS 3.2.x over 4.x | v4 still alpha, v3.2.x is production-proven | — Pending |
| Docker API for service control | Backend sends HUP/restart via Docker socket, no custom agent needed in RADIUS containers | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-03 after initialization*
