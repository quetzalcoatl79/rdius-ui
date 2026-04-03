# Feature Landscape

**Domain:** FreeRADIUS Web Management Interface
**Researched:** 2026-04-03
**Overall confidence:** HIGH (based on competitor analysis, FreeRADIUS official docs, community feedback)

---

## Competitor Feature Matrix

Before defining our feature tiers, here is what exists today across the five relevant competitors. This grounds every recommendation in evidence.

| Feature | daloRADIUS | RadMan | RADIUSdesk | OpenWISP RADIUS | dialup-admin |
|---------|-----------|--------|------------|-----------------|--------------|
| User CRUD (radcheck/radreply) | Yes | Yes | Yes | Yes | Yes |
| Group CRUD (radgroupcheck/radgroupreply) | Yes | Yes | Yes | Yes | Yes |
| User-Group assignment (radusergroup) | Yes | Yes | Yes | Yes | Yes |
| NAS management (nas table) | Yes | Yes | Yes | Limited | Yes |
| NAS groups (radhuntgroup) | No | Yes | No | No | No |
| Accounting view (radacct) | Yes | Yes | Yes | Yes | Yes |
| Active sessions (online users) | Yes | No | Yes | Yes | No |
| Graphical reporting / charts | Yes | No | Yes | Via monitoring module | No |
| Top users (bandwidth/time) | Yes | No | Yes | Via monitoring | No |
| GIS / Map view | Yes (Leaflet) | No | No | No | No |
| Billing engine | Yes | No | No | No | No |
| Bulk user import (CSV) | No | No | Shell script | Yes (Django admin) | No |
| User self-registration | No | No | No | Yes | No |
| CoA / Disconnect Messages | Yes (PoD/CoA) | No | No | Yes | No |
| RADIUS debug trace | No | No | Yes (WebSocket) | No | No |
| Server status monitoring | Yes (CPU/mem) | No | No | Via monitoring | No |
| Multi-server management | No | No | No | No | No |
| Modern UI (post-2020) | No (PHP4-era) | Partial (Java) | Partial | Django Admin | No (PHP4) |
| RBAC for UI access | Basic (ACL) | LDAP auth | Fine-grained | Django permissions | No |
| REST API | No | No | No | Yes | No |
| Docker-native deployment | Community | No | No | Yes | No |
| Configuration file management | No | No | No | No | No |
| EAP/Certificate management | No | No | No | No | No |
| Audit trail (admin actions) | Partial (logs) | No | No | Django audit | No |
| Multi-language | 2 languages | No | Yes | Yes | No |
| Active maintenance (2025+) | Barely | No | Yes | Yes | No |

**Key insight:** No existing tool offers multi-server management, modern UX, configuration file management, and comprehensive monitoring in a single product. The market is fragmented between dead/dying PHP tools and niche solutions.

---

## Table Stakes

Features users expect. Missing any of these means the product feels incomplete compared to even the worst existing tools.

| # | Feature | Why Expected | Complexity | Dependencies | Notes |
|---|---------|--------------|------------|--------------|-------|
| TS-1 | **User CRUD** (create, read, update, delete) | Every competitor has this. It is the primary reason admins want a GUI. Covers radcheck (auth attributes like passwords, auth type) and radreply (reply attributes like IP, VLAN, bandwidth limits). | Low | Database schema | Must support all attribute types: Cleartext-Password, NT-Password, MD5-Password, Crypt-Password, etc. Must show effective attributes (user + group combined). |
| TS-2 | **Group CRUD** | Groups are how admins manage policies at scale (e.g., "staff" group gets VLAN 10, "guests" get VLAN 20). Covers radgroupcheck and radgroupreply tables. | Low | TS-1 | Group-level attribute templates are critical for efficiency. |
| TS-3 | **User-Group assignment** | Maps users to groups via radusergroup table with priority ordering. | Low | TS-1, TS-2 | Must support multiple group membership with priority (lower number = higher priority). |
| TS-4 | **NAS management** | Network Access Servers (switches, APs, VPN concentrators) must be registered for RADIUS to accept their requests. Covers nas table. | Low | Database schema | Fields: nasname (IP/CIDR), shortname, type, ports, secret, server, community, description. Secret management is security-critical (show/hide toggle, never log in plaintext). |
| TS-5 | **Accounting data viewer** | Admins need to see session history for troubleshooting and compliance. Read-only view of radacct table. | Medium | Database schema | Must support filtering by username, NAS, date range, IP. Must show: session duration, input/output octets (human-readable), termination cause, called/calling station IDs. |
| TS-6 | **Active sessions view** | "Who is connected right now?" is the single most common operational question. Derived from radacct where AcctStopTime IS NULL. | Medium | TS-5 | Must show: username, NAS, IP, session duration (live), data usage. Needs periodic refresh or polling. |
| TS-7 | **Post-auth log viewer** | radpostauth table shows every auth attempt (accept/reject). Critical for debugging "why can't user X connect?" | Low | Database schema | Must show: username, reply (Accept/Reject), date, authdate. Filter by status and date range. |
| TS-8 | **Authentication with RBAC** | Admin UI must be secured. Multiple roles needed for team environments. Project defines: Super Admin, Admin, Operator, Viewer. | Medium | None (app-level) | JWT + bcrypt per PROJECT.md. Operator = read + user management, Viewer = read-only, Admin = full config, Super Admin = server management. |
| TS-9 | **Basic dashboard** | Landing page showing system health at a glance: total users, active sessions, recent auth failures, NAS count. | Medium | TS-5, TS-6, TS-7 | Key metrics as cards/counters. Every competitor with a dashboard beats those without. |
| TS-10 | **Search and filtering** | Admins managing hundreds/thousands of users need to find things fast. Must work on users, groups, NAS, accounting. | Low | TS-1 through TS-7 | Full-text search on usernames, NAS names, IP addresses. Filter by group, date range, status. |
| TS-11 | **Pagination** | Large deployments have 10K+ users, 100K+ accounting records. UI must not choke. | Low | TS-1 through TS-7 | Server-side pagination mandatory for accounting/sessions. Client-side acceptable for users/groups/NAS if under 10K. |

---

## Differentiators

Features that set the product apart. None of the competitors offer all of these. These are the reasons someone chooses Radius UI over daloRADIUS or CLI.

| # | Feature | Value Proposition | Complexity | Dependencies | Notes |
|---|---------|-------------------|------------|--------------|-------|
| D-1 | **Multi-server management** | Manage 2, 5, or 20 FreeRADIUS instances from one UI. No competitor does this. Target use case: train WiFi (one RADIUS per city), campus networks (one per building), enterprise (prod/staging/DR). | High | TS-8 | Each server = separate DB connection + Docker socket. Server selector in UI. Per-server dashboards. Cross-server user search. This is THE killer feature. |
| D-2 | **Modern, responsive UI** | Every existing tool looks like 2005. A clean, fast, accessible interface built with shadcn/ui is an immediate visual differentiator. | Medium | None | Tailwind + shadcn/ui. Dark mode. Responsive (tablet-friendly for field work). Keyboard shortcuts for power users. |
| D-3 | **Real-time statistics dashboard** | Rich charts: auth success/failure rate over time, sessions per NAS, bandwidth per user/group, peak usage times. daloRADIUS has basic graphs; RADIUSdesk has some. None are modern or interactive. | Medium | TS-5, TS-6, TS-7 | Recharts per PROJECT.md. Time-series data from radacct aggregations. Selectable time ranges (1h, 24h, 7d, 30d). Per-NAS and per-server views. |
| D-4 | **Service control** (restart, reload, status) | Start/stop/restart FreeRADIUS, send HUP for config reload, view service status -- all from the UI. Eliminates SSH access for routine operations. | Medium | D-1 | Via Docker API (docker.sock). Must show: service status (running/stopped), uptime, last restart. HUP reload for NAS table changes. Full restart for config file changes. Caution: HUP has known memory leak on some v3 versions (GitHub issue #5490). |
| D-5 | **Configuration file management** | Edit FreeRADIUS config files (modules, virtual servers, EAP settings, proxy) through a web editor. No competitor does this. Transforms the product from "SQL table editor" to "complete FreeRADIUS management." | High | D-4 | Read/write files on shared Docker volumes. Must validate syntax before applying (radiusd -C). Backup before overwrite. Show diff of changes. HUP/restart after save. High-risk feature: needs guardrails (see AF-10). |
| D-6 | **Audit trail** | Log every admin action: who created/modified/deleted what, when. No competitor has comprehensive audit logging. Critical for compliance and team environments. | Medium | TS-8 | Separate audit_log table in app DB (not FreeRADIUS DB). Covers: user CRUD, group CRUD, NAS changes, config file edits, service control actions. Filterable by admin, action type, date. |
| D-7 | **Bulk operations** | Import users from CSV, batch assign groups, batch delete expired users, batch update attributes. Only OpenWISP has CSV import. | Medium | TS-1, TS-2, TS-3 | CSV import with preview/validation before commit. Batch group assignment via checkboxes. Batch attribute updates (e.g., change VLAN for all users in a group). Export users/groups to CSV. |
| D-8 | **CoA and Disconnect Messages** | Send Change of Authorization or Disconnect-Request packets to NAS devices from the UI. Kick a user, change their VLAN, update bandwidth limits -- in real time without waiting for re-auth. | High | TS-4, TS-6 | Backend must implement RADIUS client functionality (send CoA/DM packets via pyrad). Need NAS IP, secret, session attributes. Only daloRADIUS and OpenWISP offer this. Huge operational value for troubleshooting. |
| D-9 | **User/group attribute templates** | Pre-defined attribute sets for common scenarios: "802.1X PEAP user", "Guest with 1-day expiry", "VPN user with static IP". Admins select a template instead of manually adding 5-10 attributes. | Low | TS-1, TS-2 | Admin-configurable templates stored in app DB. Reduces errors and onboarding time. No competitor has this. |
| D-10 | **Server health monitoring** | CPU, memory, disk usage, FreeRADIUS process stats, DB connection pool status. Goes beyond "is the service running" to "is it healthy." | Medium | D-1 | Via Docker API stats endpoint + system metrics. Alert thresholds (e.g., disk > 90%). Historical metrics (last 24h at minimum). |
| D-11 | **NAS group management** (radhuntgroup) | Organize NAS devices into logical groups (by site, floor, function). Only RadMan supports this. Useful for applying policies per NAS group. | Low | TS-4 | Simple CRUD on radhuntgroup table. Links NAS devices to named groups. Enables group-based policy assignment in FreeRADIUS authorize section. |
| D-12 | **Connectivity testing** | Test RADIUS authentication from the UI: enter username/password, select a NAS, send Access-Request, see if it succeeds. "Does this user work?" without needing radtest CLI. | Medium | TS-1, TS-4 | Backend acts as RADIUS client via pyrad. Send test auth to localhost or remote server. Show detailed response (Accept/Reject, reply attributes). daloRADIUS has this; critical for troubleshooting. |
| D-13 | **Policy visualization** (effective attributes) | Show the complete "effective policy" for a user: their personal attributes + inherited group attributes, merged with priority. "What will this user actually get when they authenticate?" | Medium | TS-1, TS-2, TS-3 | Aggregate data from radcheck + radgroupcheck + radusergroup. Display as a merged, read-only view. Highlight conflicts between user and group attributes. No competitor does this well. |

---

## Anti-Features

Features to explicitly NOT build. These seem useful but are actually problematic, out of scope, or dangerous.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|--------------|-----------|-------------------|
| AF-1 | **Billing / payment engine** | daloRADIUS has one; it is the most complained-about, least-used feature. Billing is a separate domain with its own complexity (invoicing, taxes, payment gateways, refunds). Building it diverts resources from core RADIUS management. Target users (enterprise network admins) do not bill end-users through RADIUS. | Expose accounting data via API. Let external billing systems consume it. Provide data export (CSV/JSON) for billing integration. |
| AF-2 | **GIS / map view of NAS devices** | daloRADIUS integrates Leaflet for mapping hotspots. Sounds cool, rarely used in practice. Requires GPS coordinates for every NAS (data admins rarely have). Adds mapping library weight. Target users manage enterprise switches and APs, not public hotspots. | Add optional lat/lng fields to NAS records for future use. A simple table with site/location text column is more practical for enterprise. |
| AF-3 | **User self-registration portal** | OpenWISP's signature feature. Relevant for ISPs and public WiFi, not for enterprise 802.1X deployments where IT provisions accounts. Building it means building a separate user-facing app with email verification, captive portal integration, terms of service, etc. | Out of scope. If needed later, build as a separate micro-frontend. The admin UI manages accounts; it is not a captive portal. |
| AF-4 | **Real-time packet capture / debug mode** | Running `radiusd -X` from the UI sounds powerful but is extremely dangerous: it restarts RADIUS in debug mode (single-threaded, no accounting), flooding the UI with thousands of log lines per second. RADIUSdesk's WebSocket debug trace is the closest attempt; it is complex and fragile. | Provide log file viewing (tail -f equivalent via WebSocket for radius.log). For deep debugging, admins use SSH + `radiusd -X`. Document this in help section. |
| AF-5 | **LDAP/AD directory browser** | Browsing and managing LDAP/AD from the RADIUS UI conflates two separate systems. FreeRADIUS can authenticate against LDAP, but managing the LDAP directory is not RADIUS's job. Building an LDAP browser is a project unto itself. | Allow configuring the LDAP module connection string via config file editor (D-5). LDAP user provisioning is the directory admin's responsibility. Per PROJECT.md: deferred. |
| AF-6 | **Custom RADIUS dictionary editor** | Editing FreeRADIUS dictionary files (vendor-specific attributes) from the UI risks breaking the entire server. Dictionary syntax is complex and errors are catastrophic (server won't start). Very few admins need custom dictionaries beyond the standard set. | Ship with the standard FreeRADIUS dictionary. If custom dictionaries are needed, admins edit them via the filesystem. Provide a read-only dictionary browser in the UI for reference when configuring attributes. |
| AF-7 | **Multi-tenant SaaS platform** | Per PROJECT.md, v1 is instance-per-client, Docker Compose deployed. Multi-tenancy adds: tenant isolation, shared-nothing DB, per-tenant billing, onboarding flows, SSO, data residency compliance. This is a complete architecture rethink. | Build v1 as single-instance. Multi-tenancy is explicitly v2 per PROJECT.md. The instance-per-client model provides better isolation, simpler operations, and lower risk. |
| AF-8 | **Social login (Google, Facebook, etc.)** | OpenWISP supports this for captive portal scenarios. Irrelevant for enterprise RADIUS where auth is 802.1X certificates or username/password against a corporate directory. | Not applicable to target users. Do not build. |
| AF-9 | **FreeRADIUS v4.x support** | v4 is still alpha. Its config format changed significantly (proxy.conf replaced by rlm_radius module, module syntax changes, new virtual server syntax). Supporting both v3 and v4 doubles the config management complexity. | Target v3.2.x only per PROJECT.md. Revisit when v4 reaches stable release. |
| AF-10 | **Raw text editor for all config files (no guardrails)** | Exposing a raw text editor for every config file (radiusd.conf, all modules, all sites) with no validation is how admins brick their RADIUS server. One syntax error in any file = service won't restart = production outage. | Use structured forms for common settings (EAP parameters, SQL module config). Use a code editor with syntax highlighting for advanced/custom configs. Always: validate via `radiusd -C`, create backup before overwrite, show diff of changes, and confirm before applying. |
| AF-11 | **In-browser terminal / SSH shell** | Security nightmare. Exposing shell access through a web UI creates a massive attack surface. No amount of sandboxing makes this safe for a RADIUS management tool. | Provide targeted service control buttons (restart, reload) via Docker API. For CLI operations, admins use their own SSH client. |
| AF-12 | **Automatic FreeRADIUS installation/provisioning** | Out of scope. Product assumes FreeRADIUS is already running in Docker containers. Auto-provisioning new servers involves OS-level operations, networking, certificates, and infrastructure decisions that belong to the deployment pipeline, not the management UI. | Provide Docker Compose templates and documentation for setting up new FreeRADIUS instances. The UI manages what exists; it does not create infrastructure. |

---

## Feature Dependencies

```
                                    [Database Schema]
                                          |
                    +---------------------+---------------------+
                    |                     |                     |
                [TS-1: Users]      [TS-4: NAS]          [TS-5: Accounting]
                    |                     |                     |
              [TS-2: Groups]             |              [TS-6: Active Sessions]
                    |                     |                     |
            [TS-3: User-Group]           |              [TS-7: Post-auth Logs]
                    |                     |                     |
                    +-----+-----+---------+----------+----------+
                          |     |                    |
                    [TS-10: Search]           [TS-9: Dashboard]
                    [TS-11: Pagination]              |
                          |                   [D-3: Rich Stats]
                    [D-7: Bulk Ops]
                    [D-9: Templates]
                    [D-13: Policy View]

              [TS-8: Auth + RBAC] -----> [D-6: Audit Trail]
                       |
              [D-1: Multi-Server] -----> [D-4: Service Control]
                                               |
                                        [D-5: Config File Mgmt]
                                        [D-10: Health Monitoring]

              [TS-4: NAS] + [TS-6: Sessions] -----> [D-8: CoA/Disconnect]

              [TS-4: NAS] -----> [D-11: NAS Groups]
                                 [D-12: Connectivity Test]
```

### Critical Path

The longest dependency chain that determines minimum time to first usable product:

```
Database Schema -> Users -> Groups -> User-Group -> Search/Pagination -> Dashboard -> Rich Stats
                                                                                        |
Auth + RBAC -> Multi-Server -> Service Control -> Config File Mgmt            (parallel path)
```

### Dependency Rules

1. **Users, Groups, NAS, Accounting** can be built in parallel (all depend only on DB schema)
2. **Active Sessions** requires Accounting (it queries the same radacct table with a filter)
3. **Dashboard** requires at least Users, NAS, Accounting, and Active Sessions for meaningful metrics
4. **Multi-Server** must exist before Service Control (you need to know which server to control)
5. **Config File Management** requires Service Control (you need to restart/HUP after editing configs)
6. **CoA/Disconnect** requires both NAS (for secret/IP) and Active Sessions (to identify targets)
7. **Audit Trail** requires Auth+RBAC (you need to know who performed the action)
8. **Bulk Operations** requires Users and Groups to already work individually
9. **Templates** require Users and Groups (templates produce attributes for those entities)
10. **Policy Visualization** requires Users, Groups, and User-Group assignment (aggregates all three)

---

## MVP Recommendation

### Phase 1: Core Data Management (Table Stakes Foundation)

Build the foundation that makes the product minimally useful. An admin should be able to manage users, groups, and NAS devices on a single FreeRADIUS server.

**Prioritize:**
1. **TS-8: Auth + RBAC** -- Must be first; everything else is behind a login
2. **TS-1: User CRUD** -- The #1 reason admins want a GUI
3. **TS-2: Group CRUD** -- Groups are how policies scale
4. **TS-3: User-Group assignment** -- Connects users to groups
5. **TS-4: NAS management** -- Without NAS entries, RADIUS rejects all requests
6. **TS-10: Search and filtering** -- Usability requirement from day one
7. **TS-11: Pagination** -- Performance requirement from day one
8. **D-2: Modern UI** -- Not a separate phase; the UI quality is baked into every component

### Phase 2: Observability

Make the product useful for day-to-day operations (troubleshooting, monitoring).

**Prioritize:**
1. **TS-5: Accounting data viewer** -- "What happened?"
2. **TS-6: Active sessions** -- "What is happening now?"
3. **TS-7: Post-auth log viewer** -- "Why was this user rejected?"
4. **TS-9: Basic dashboard** -- At-a-glance system health
5. **D-3: Rich statistics dashboard** -- Charts and trends (Recharts)

### Phase 3: Multi-Server + Operations

The killer differentiator. This is where Radius UI stops being "another daloRADIUS" and becomes a unique product.

**Prioritize:**
1. **D-1: Multi-server management** -- The architectural foundation for everything else
2. **D-4: Service control** -- Restart/reload from UI
3. **D-10: Server health monitoring** -- CPU, memory, disk per server
4. **D-6: Audit trail** -- Who did what, when (critical for multi-admin teams)

### Phase 4: Advanced Operations

Power features for experienced admins.

**Prioritize:**
1. **D-5: Configuration file management** -- The hardest and most valuable differentiator
2. **D-7: Bulk operations** -- CSV import, batch updates, export
3. **D-8: CoA/Disconnect messages** -- Real-time session control
4. **D-12: Connectivity testing** -- Built-in radtest equivalent
5. **D-9: Attribute templates** -- Productivity accelerator
6. **D-11: NAS group management** -- Organizational feature
7. **D-13: Policy visualization** -- Effective attribute aggregation view

**Defer indefinitely:** AF-1 through AF-12 (all anti-features)

---

## Feature Prioritization Matrix

| Feature | User Value | Competitive Gap | Build Complexity | Risk | Priority |
|---------|-----------|-----------------|-----------------|------|----------|
| D-1: Multi-server | Critical | Unique (no competitor) | High | Medium | **P0** |
| TS-1: User CRUD | Critical | Parity | Low | Low | **P0** |
| TS-2: Group CRUD | Critical | Parity | Low | Low | **P0** |
| TS-4: NAS management | Critical | Parity | Low | Low | **P0** |
| TS-8: Auth + RBAC | Critical | Above (vs daloRADIUS) | Medium | Low | **P0** |
| D-2: Modern UI | High | Unique | Medium | Low | **P0** |
| TS-5: Accounting | High | Parity | Medium | Low | **P1** |
| TS-6: Active sessions | High | Parity | Medium | Low | **P1** |
| TS-7: Post-auth logs | High | Parity | Low | Low | **P1** |
| TS-9: Dashboard | High | Above | Medium | Low | **P1** |
| D-3: Rich stats | Medium | Above | Medium | Low | **P1** |
| D-4: Service control | High | Unique | Medium | Medium | **P2** |
| D-6: Audit trail | Medium | Unique | Medium | Low | **P2** |
| D-10: Health monitoring | Medium | Unique | Medium | Low | **P2** |
| D-5: Config file mgmt | High | Unique | High | **High** | **P3** |
| D-7: Bulk operations | Medium | Above | Medium | Low | **P3** |
| D-8: CoA/Disconnect | Medium | Above (vs daloRADIUS) | High | Medium | **P3** |
| D-12: Connectivity test | Medium | Parity (daloRADIUS) | Medium | Low | **P3** |
| D-13: Policy visualization | Medium | Unique | Medium | Low | **P3** |
| D-9: Templates | Low-Medium | Unique | Low | Low | **P3** |
| D-11: NAS groups | Low | Parity (RadMan only) | Low | Low | **P3** |

**Priority definitions:**
- **P0:** Must have for launch. Without these, the product has no reason to exist.
- **P1:** Must have for production use. Without these, admins cannot do their daily job.
- **P2:** Should have. These are the differentiators that justify switching from existing tools.
- **P3:** Nice to have. These delight power users and handle advanced scenarios.

---

## Sources

### Competitor Repositories and Documentation
- [daloRADIUS GitHub](https://github.com/lirantal/daloradius) -- Feature list, issues, PHP compatibility problems
- [daloRADIUS PHP7 issues](https://github.com/lirantal/daloradius/issues/52) -- Concrete evidence of technical debt
- [RadMan GitHub](https://github.com/netcore-jsa/radman) -- Java-based FreeRADIUS manager, table management scope
- [RADIUSdesk](https://www.radiusdesk.com/) -- Mesh network + RADIUS management, WebSocket debug trace
- [RADIUSdesk on AlternativeTo](https://alternativeto.net/software/radiusdesk/about/) -- Feature overview
- [OpenWISP RADIUS GitHub](https://github.com/openwisp/openwisp-radius) -- Django-based, REST API, CSV import, CoA support
- [OpenWISP CSV Import docs](https://openwisp-radius.readthedocs.io/en/stable/user/importing_users.html) -- Bulk import reference
- [dialup-admin GitHub](https://github.com/FreeRADIUS/dialup-admin) -- Legacy official FreeRADIUS GUI
- [freeradius-web-ui GitHub](https://github.com/arch-lamp/freeradius-web-ui) -- Minimal user/NAS manager (PostgreSQL)
- [django-freeradius-manager](https://github.com/UniversitaDellaCalabria/django-freeradius-manager) -- Identity provisioning approach
- [RadiusAdmin GitHub](https://github.com/Compizfox/RadiusAdmin) -- PHP FreeRADIUS web interface

### FreeRADIUS Official Documentation
- [FreeRADIUS SQL Module](https://wiki.freeradius.org/modules/Rlm_sql) -- SQL table schemas and usage
- [FreeRADIUS SQL HOWTO](https://wiki.freeradius.org/guide/SQL-HOWTO) -- Table structure patterns
- [FreeRADIUS PostgreSQL Schema](https://github.com/FreeRADIUS/freeradius-server/blob/master/raddb/mods-config/sql/main/postgresql/schema.sql) -- Authoritative table definitions
- [Virtual Servers](https://wiki.freeradius.org/config/Virtual-server) -- sites-available/sites-enabled pattern
- [Configuration Files](https://wiki.freeradius.org/config/Configuration-files) -- mods-available/mods-enabled structure
- [Data Usage Reporting](https://wiki.freeradius.org/guide/Data-Usage-Reporting) -- radacct aggregation patterns
- [EAP-TLS Configuration](https://www.freeradius.org/documentation/freeradius-server/3.2.9/tutorials/eap-tls.html) -- Certificate setup
- [HUP Signal Memory Leak](https://github.com/FreeRADIUS/freeradius-server/issues/5490) -- Known issue with reload
- [Proxy Configuration](https://wiki.freeradius.org/config/Proxy) -- proxy.conf structure (v3)

### Market Analysis
- [CloudRADIUS - FreeRADIUS GUI article](https://cloudradius.com/is-there-a-freeradius-gui/) -- Market gap analysis
- [JumpCloud - FreeRADIUS GUI](https://jumpcloud.com/blog/freeradius-gui) -- Admin pain points
- [Cloud Infrastructure Services - Best FreeRADIUS GUI](https://cloudinfrastructureservices.co.uk/best-freeradius-gui-web-interfaces/) -- Tool comparison
- [daloRADIUS DeepWiki](https://deepwiki.com/lirantal/daloradius/1-overview) -- Detailed feature breakdown

### RADIUS Protocol and Operations
- [Cisco - RADIUS CoA and Disconnect](https://www.cisco.com/c/en/us/support/docs/wireless/ggsn-gateway-gprs-support-node/119397-technote-radiusdm-00.html) -- CoA protocol details
- [JumpCloud - RADIUS CoA explained](https://jumpcloud.com/it-index/what-is-radius-coa-change-of-authorization) -- Change of Authorization overview
- [FreeRADIUS Accounting](https://www.freeradius.org/documentation/freeradius-server/3.2.9/tutorials/accounting.html) -- radacct table usage
