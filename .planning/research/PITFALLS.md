# Domain Pitfalls

**Domain:** FreeRADIUS Web Management UI
**Researched:** 2026-04-03
**Overall confidence:** HIGH (verified against official FreeRADIUS docs, GitHub issues, and community reports)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or production outages.

---

### CP-1: Shared Database Schema Ownership Conflict

**What goes wrong:** The application (FastAPI + Alembic) and FreeRADIUS both read/write the same PostgreSQL database. Alembic autogenerate detects FreeRADIUS tables (radcheck, radreply, radacct, etc.) as "unmanaged" and either tries to modify them or drops them entirely. A single bad migration destroys FreeRADIUS's ability to authenticate users.

**Why it happens:** Alembic's `--autogenerate` compares SQLAlchemy models against the live database schema. If FreeRADIUS tables are reflected as SQLAlchemy models, Alembic assumes ownership. If they are NOT reflected, Alembic may flag them for removal. Developers running `alembic upgrade head` in CI/CD without reviewing migrations silently break the RADIUS schema.

**Consequences:**
- FreeRADIUS stops authenticating if its tables are altered (column renamed, constraint added, index dropped)
- Data loss if radacct or radpostauth tables are truncated/dropped by a migration
- Silent failures: FreeRADIUS continues running but returns Access-Reject for all requests

**Prevention:**
1. **Separate schemas.** Use PostgreSQL schemas: `radius` schema for FreeRADIUS tables, `app` schema for application tables. Configure Alembic's `include_schemas` and `include_name` filters in `env.py` to ONLY manage the `app` schema
2. **Never autogenerate against FreeRADIUS tables.** Use `include_object` callback in Alembic env.py to exclude tables matching `rad*`, `nas`, `cui` patterns:
```python
# alembic/env.py
RADIUS_TABLES = {"radcheck", "radreply", "radgroupcheck", "radgroupreply",
                 "radusergroup", "radacct", "radpostauth", "nas"}

def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name in RADIUS_TABLES:
        return False
    return True
```
3. **Reflect, don't declare.** Map FreeRADIUS tables using SQLAlchemy `autoload_with=engine` or manual `Table()` reflection with `extend_existing=True`. Never define them as declarative models with `__tablename__`
4. **Migration review gate.** Every Alembic migration must be human-reviewed before merging. Add a CI check that fails if a migration touches any table in the `radius` schema
5. **Database user separation.** FreeRADIUS connects with a `radius_rw` user (full access to radius schema), the app connects with an `app_rw` user (full access to app schema, read-only on radius schema)

**Warning signs:**
- Alembic autogenerate produces unexpected `drop_table` or `alter_column` operations
- FreeRADIUS logs `rlm_sql: Failed executing query` after a deployment
- Authentication suddenly returns Access-Reject for all users

**Detection:** Pre-deployment script that diffs the FreeRADIUS schema against the official `schema.sql` checksum. Alert if any FreeRADIUS table structure has changed.

**Phase:** Must be addressed in Phase 1 (database foundation). If wrong, everything built on top is fragile.

**Confidence:** HIGH -- verified against FreeRADIUS official schema.sql and Alembic documentation.

---

### CP-2: RADIUS Operator Misuse in radcheck/radreply Tables

**What goes wrong:** The UI inserts rows into radcheck/radreply with incorrect operators. Users cannot authenticate, get wrong VLAN assignments, receive duplicate attributes, or bypass session limits. The failure is silent -- FreeRADIUS processes the row but produces wrong results.

**Why it happens:** RADIUS operators (`:=`, `==`, `+=`, `=`, `!=`, etc.) have completely different semantics depending on whether they appear in check items vs reply items. Developers unfamiliar with RADIUS treat the `op` column as a simple equals sign. The FreeRADIUS default schema has different default ops for radcheck (`==`) vs radreply (`=`), which is a clue developers miss.

**Complete operator reference (check vs reply behavior):**

| Operator | In Check Items | In Reply Items |
|----------|---------------|----------------|
| `=` | Not allowed for protocol attrs; sets config if absent | Adds only if no same-name attr exists |
| `:=` | Always matches; replaces any existing attr | Replaces in reply items |
| `==` | Matches if attr present with given value | NOT ALLOWED |
| `+=` | Always matches; appends to config | Appends to reply |
| `!=` | Matches if attr present, value differs | NOT ALLOWED |

**Specific operator traps:**

| Scenario | Wrong Op | Correct Op | Consequence |
|----------|----------|------------|-------------|
| Setting password in radcheck | `==` | `:=` | `==` compares against request, always fails for Cleartext-Password |
| Single reply attribute (Framed-IP) | `+=` | `:=` | `+=` appends, creating duplicates on re-auth |
| Multiple Cisco-AVPair reply attrs | `:=` | `+=` | `:=` replaces, only the last AVPair survives |
| Simultaneous-Use check | `=` | `:=` | `=` has undefined behavior for check items in SQL mode |
| VLAN assignment in radreply | empty | `:=` | Empty op means FreeRADIUS ignores the row entirely |

**Prevention:**
1. **Operator validation layer.** The backend MUST enforce valid operators per context. Build a validation map: `{table: "radcheck", attribute: "*-Password", allowed_ops: [":="]}`, `{table: "radreply", default_op: ":=", multi_value_attrs: ["Cisco-AVPair"], multi_op: "+="}`
2. **UI operator guidance.** Show a dropdown with only valid operators for the selected table/attribute combination. Include tooltip explaining what each operator does
3. **Never allow empty `op` field.** The database allows it (VARCHAR(2) with DEFAULT), but FreeRADIUS behavior is undefined when `op` is empty
4. **Integration tests.** After every CRUD operation on RADIUS tables, run `radtest` to verify the user can still authenticate

**Warning signs:**
- Users report "password is correct but authentication fails"
- radpostauth table shows Access-Reject with no apparent reason
- Reply attributes are missing or duplicated in RADIUS responses

**Phase:** Phase 2 (user/group management). This is the most common source of bugs in every FreeRADIUS management UI ever built.

**Confidence:** HIGH -- verified against official FreeRADIUS operators wiki and PostgreSQL schema.

**Sources:**
- [FreeRADIUS Operators Wiki](https://wiki.freeradius.org/config/Operators)
- [FreeRADIUS SQL HOWTO](https://wiki.freeradius.org/guide/SQL-HOWTO)
- [daloRADIUS VLAN issue #576](https://github.com/lirantal/daloradius/issues/576)

---

### CP-3: NAS Client Changes Require FreeRADIUS Restart, Not Reload

**What goes wrong:** The UI adds a new NAS device to the `nas` SQL table and sends a HUP signal to FreeRADIUS expecting the new client to be recognized. It is not. RADIUS packets from the new NAS are silently dropped because FreeRADIUS only reads the NAS table at startup, not on HUP.

**Why it happens:** FreeRADIUS loads NAS/client definitions (from both `clients.conf` and the SQL `nas` table with `read_clients=yes`) ONCE at startup. A HUP signal reloads modules and some config files, but NOT the client list. This is a deliberate design decision for performance and security.

**Consequences:**
- New NAS devices silently fail to authenticate users
- Admin adds NAS in UI, tests from that NAS, gets timeout -- assumes the UI is broken
- Support escalation for a "bug" that is actually expected FreeRADIUS behavior

**Prevention:**
1. **Restart, not reload, for NAS changes.** When the UI modifies the `nas` table, the backend must perform a full container restart (not just `kill -HUP`). Document this clearly in the UI with a warning: "Adding/modifying a NAS device requires a FreeRADIUS service restart"
2. **Batch NAS changes.** Provide a "pending changes" workflow where admins can queue multiple NAS additions, then apply them all at once with a single restart
3. **Consider dynamic clients.** FreeRADIUS 3.2.x supports `dynamic_clients` via a virtual server lookup. When a packet arrives from an unknown client, FreeRADIUS queries SQL dynamically. This avoids restarts but adds per-request overhead and complexity. Evaluate based on NAS addition frequency
4. **Clear UI feedback.** After NAS table modification, show a prominent banner: "FreeRADIUS restart required for changes to take effect" with a restart button

**Warning signs:**
- New NAS devices time out on RADIUS requests
- `radiusd -X` debug shows "Ignoring request from unknown client"
- Admin reports "I added the NAS but it doesn't work"

**Phase:** Phase 2-3 (NAS management). Must be designed into the NAS management workflow from the start.

**Confidence:** HIGH -- confirmed by multiple FreeRADIUS mailing list threads and the official FAQ.

**Sources:**
- [FreeRADIUS FAQ](https://wiki.freeradius.org/guide/FAQ)
- [NAS from DB discussion](https://freeradius-users.freeradius.narkive.com/arkSZbSE/nas-from-db-add-without-restart)
- [FreeRADIUS-NAS-change-restarter](https://github.com/jda/FreeRADIUS-NAS-change-restarter)

---

### CP-4: Docker Socket Exposure Grants Root Access to Host

**What goes wrong:** The backend container mounts `/var/run/docker.sock` to send restart/HUP signals to FreeRADIUS containers. If the backend is compromised (SSRF, RCE, dependency vulnerability), the attacker has full root access to the Docker host -- they can create privileged containers, mount the host filesystem, exfiltrate data, or pivot to other infrastructure.

**Why it happens:** Docker socket access is equivalent to root access. The socket provides unrestricted access to the Docker Engine API: create containers, exec into them, mount host volumes. There is no built-in permission model.

**Consequences:**
- Complete host compromise from a single web application vulnerability
- Lateral movement to other containers and services
- Data exfiltration from all containers on the host

**Prevention:**
1. **Docker socket proxy (mandatory).** Deploy [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) or [wollomatic/socket-proxy](https://github.com/wollomatic/socket-proxy) as a sidecar. Configure it to ONLY allow:
   - `CONTAINERS=1` (read container list)
   - `POST` to `/containers/{id}/restart` and `/containers/{id}/kill` (send signals)
   - Block ALL other endpoints: no `CREATE`, no `EXEC`, no `VOLUMES`, no `IMAGES`
2. **Backend never touches the real socket.** The backend connects to the socket proxy over a Docker network, never to `/var/run/docker.sock` directly
3. **Restrict by container label.** The socket proxy should only expose containers with a specific label (e.g., `radius-ui.managed=true`), preventing the backend from controlling unrelated containers
4. **Audit logging.** Log every Docker API call through the proxy for forensic review
5. **Network isolation.** The socket proxy container sits on an internal-only Docker network, unreachable from the frontend or external networks

**Warning signs:**
- `docker.sock` appears in a `volumes:` mount for the backend service
- No socket proxy in docker-compose.yml
- Backend code uses the Docker SDK with unrestricted access

**Phase:** Phase 1 (infrastructure setup). The Docker Compose architecture must include the socket proxy from day one.

**Confidence:** HIGH -- OWASP Docker Security Cheat Sheet, Docker official docs.

**Sources:**
- [Docker Security - OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Protect Docker daemon socket - Docker Docs](https://docs.docker.com/engine/security/protect-access/)
- [Tecnativa docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)

---

### CP-5: HUP Signal Memory Leak in FreeRADIUS 3.2.x

**What goes wrong:** Sending repeated HUP signals to FreeRADIUS 3.2.x causes a memory leak. Memory grows after each reload and never decreases. In a management UI that encourages frequent config changes and reloads, this leads to FreeRADIUS exhausting container memory and crashing.

**Why it happens:** This is a confirmed bug in FreeRADIUS 3.2.x (GitHub issue #5490). Starting from the second HUP reload, memory allocated during configuration re-read is not properly freed.

**Consequences:**
- FreeRADIUS process grows in memory over time
- Container hits memory limit and is OOM-killed
- Authentication outage until container restarts

**Prevention:**
1. **Batch configuration changes.** Don't HUP after every UI change. Accumulate changes and reload once when the admin clicks "Apply changes"
2. **Prefer full restart over HUP for major changes.** A clean restart is more predictable and doesn't accumulate leaked memory
3. **Container memory monitoring.** Set memory limits on FreeRADIUS containers AND alert when usage exceeds 80% of limit. The health monitoring dashboard should track FreeRADIUS container memory
4. **Periodic restart schedule.** Consider a maintenance restart (e.g., daily at low-traffic time) if HUP is used frequently. Implement graceful restart that waits for in-flight requests to complete
5. **Track upstream fix.** Monitor the FreeRADIUS GitHub issue for a patch. If fixed in a point release, upgrade promptly

**Warning signs:**
- FreeRADIUS container memory usage steadily increases over days/weeks
- Container restarts appear in Docker logs with OOM kill signals
- Authentication latency increases gradually after multiple config reloads

**Phase:** Phase 3 (configuration management, service control). The reload/restart strategy must account for this bug.

**Confidence:** HIGH -- confirmed bug with GitHub issue reference.

**Sources:**
- [Memory leak on HUP - Issue #5490](https://github.com/FreeRADIUS/freeradius-server/issues/5490)

---

### CP-6: Shared Secrets Exposed Through API or Logs

**What goes wrong:** RADIUS shared secrets (between NAS devices and FreeRADIUS) are stored in the `nas` table's `secret` column. The API returns the full NAS object including the plaintext secret, or the secret appears in application logs, debug output, or error messages. An attacker with read access to the API or logs can impersonate any NAS device.

**Why it happens:** The `nas` table stores secrets in plaintext (FreeRADIUS requires plaintext access to verify RADIUS packets). Developers serialize the full database row to JSON without excluding sensitive fields. Logging middleware captures request/response bodies including secrets.

**Consequences:**
- Attacker can send forged RADIUS packets to FreeRADIUS, authenticating arbitrary users
- RADIUS protocol security depends COMPLETELY on the shared secret. A compromised secret means zero security
- Shared secrets shorter than 16 characters can be brute-forced (8 chars in ~1 day with a GPU per FreeRADIUS docs)

**Prevention:**
1. **API response filtering.** NEVER return the `secret` field in NAS list/detail endpoints. Use a separate "reveal secret" endpoint with elevated RBAC permissions (Super Admin only), rate-limited and audit-logged
2. **Write-only secret pattern.** The UI can SET a secret but cannot READ it back. Display masked value (e.g., `****...last4`). Provide a "regenerate secret" button that generates a cryptographically random 32-character secret
3. **Log scrubbing.** Middleware must redact any field named `secret`, `password`, or `shared_secret` from log output. Test this explicitly
4. **Minimum secret length.** Enforce minimum 16 characters (FreeRADIUS recommends 32). Reject weak secrets (dictionary words, common patterns)
5. **Secret rotation workflow.** Provide a UI workflow to rotate secrets: generate new secret -> update NAS table -> provide new secret for admin to configure on the NAS device -> restart FreeRADIUS

**Warning signs:**
- API response for `/api/nas/` includes a `secret` field with plaintext values
- Application logs contain NAS secrets
- No RBAC differentiation for secret access

**Phase:** Phase 2 (NAS management). Must be designed into the NAS API from the first endpoint.

**Confidence:** HIGH -- FreeRADIUS official security documentation.

**Sources:**
- [Making RADIUS More Secure - InkBridge Networks](https://www.inkbridgenetworks.com/blog/blog-10/making-radius-more-secure-76)
- [FreeRADIUS clients.conf documentation](https://www.freeradius.org/documentation/freeradius-server/4.0.0/reference/raddb/clients.conf.html)

---

### CP-7: Cleartext Passwords in radcheck (Unavoidable but Must Be Managed)

**What goes wrong:** FreeRADIUS in SQL mode often uses `Cleartext-Password` in radcheck for simplicity. Database breach exposes all RADIUS user passwords in plaintext.

**Why it happens:** CHAP, MS-CHAP, and EAP-MSCHAPv2 (the most common enterprise protocols) require access to the cleartext password or NT-Password hash. This is a RADIUS protocol limitation, not a FreeRADIUS bug.

**Consequences:** All RADIUS user passwords compromised in a database breach. Potential compliance violations (PCI-DSS, SOC2).

**Prevention:**
1. **PAP-only environments:** Use `Crypt-Password` with bcrypt hashing instead of Cleartext-Password
2. **CHAP/MS-CHAP/EAP-PEAP:** Use `NT-Password` (MD4 hash). Not ideal but better than cleartext
3. **Encrypt database at rest.** PostgreSQL volume encryption or TDE
4. **Restrict database access.** Only FreeRADIUS and the backend should have SQL access. No direct admin SQL access
5. **Document the tradeoff.** The UI should warn when Cleartext-Password is being used and suggest alternatives based on the authentication protocol in use
6. **Application-level encryption.** Consider encrypting the password value before storing in radcheck and having FreeRADIUS use a Perl/Python module to decrypt. Complex but possible

**Phase:** Phase 2 (user management). Must be a conscious decision, not an oversight.

**Confidence:** HIGH -- FreeRADIUS FAQ on password storage.

---

## Technical Debt Patterns

Mistakes that don't break immediately but accumulate into major problems.

---

### TD-1: radacct Table Grows Without Bound

**What goes wrong:** The `radacct` table accumulates every RADIUS accounting record forever. After a few months in production (especially with many NAS devices), the table reaches millions of rows. FreeRADIUS query performance degrades because simultaneous-use checks, session lookups, and accounting updates all hit this table.

**Why it happens:** The default FreeRADIUS schema has no partitioning, no archival, and no TTL. RADIUS is a high-write-volume protocol: every session start, interim update, and stop generates a row.

**Specific thresholds (from FreeRADIUS GitHub issue #5628):**
- ~2 million records: performance degrades noticeably without additional indexing
- ~10 million records: unacceptable performance even with custom indexes
- FreeRADIUS alone handles 40,000-50,000 packets/sec; with SQL it drops to ~2,000 packets/sec. A slow database makes this worse

**Prevention:**
1. **PostgreSQL table partitioning from day one.** Partition `radacct` by `AcctStartTime` using monthly ranges. Use `pg_partman` for automated partition management
2. **Archival cron job.** Move records older than 90 days to `radacct_archive`. Keep the active table small
3. **Separate "active sessions" view.** Create a materialized view or separate table for sessions where `AcctStopTime IS NULL`. This is what the dashboard queries, not the full radacct table
4. **Index the right columns.** Default schema indexes are adequate for small datasets. For production, add composite indexes on `(UserName, AcctStopTime)` for simultaneous-use and `(NASIPAddress, AcctStartTime, AcctStopTime)` for NAS-specific queries. But keep total indexes under 10 per table -- each index slows writes
5. **Same treatment for `radpostauth`.** This table also grows without bound. Partition or archive it alongside radacct

**Phase:** Phase 1 (database setup) for partitioning. Phase 4+ for archival automation.

**Confidence:** HIGH -- confirmed by FreeRADIUS GitHub issue #5628 and InkBridge Networks article.

**Sources:**
- [PostgreSQL performance degradation - Issue #5628](https://github.com/FreeRADIUS/freeradius-server/issues/5628)
- [InkBridge: My FreeRADIUS server is slow](https://www.inkbridgenetworks.com/blog/blog-10/my-freeradius-server-is-slow-what-s-wrong-97)

---

### TD-2: Attribute Name Hardcoding Instead of Dictionary Awareness

**What goes wrong:** The UI hardcodes RADIUS attribute names (e.g., `Framed-IP-Address`, `Cisco-AVPair`) as string constants. When NAS vendors require vendor-specific attributes (VSAs), admins cannot add them. When FreeRADIUS dictionary updates rename or add attributes, the UI becomes out of date.

**Why it happens:** RADIUS has hundreds of standard attributes and thousands of vendor-specific attributes. Developers implement the 20 most common ones and call it done. The attribute namespace is defined by FreeRADIUS dictionary files, not by any API.

**Specific dictionary trap:** Attribute names like `Password` or `Vendor-Password` are NOT valid -- the correct names are `User-Password`, `Cleartext-Password`, etc. Using wrong names produces "Failed to create the pair: Invalid vendor name in attribute name" errors that are hard to debug.

**Prevention:**
1. **Parse FreeRADIUS dictionary files.** On backend startup, read the dictionary files from the FreeRADIUS container (via shared volume or Docker exec) and build a searchable attribute registry
2. **Attribute autocomplete in the UI.** Don't use a dropdown with 20 hardcoded values. Use a searchable autocomplete that queries the parsed dictionary
3. **Vendor-specific attribute support.** Group attributes by vendor in the UI (IETF standard, Cisco, Mikrotik, etc.). Allow free-text entry for unknown attributes with a warning
4. **Attribute type validation.** Dictionary files define attribute types (string, integer, ipaddr, date). Use these types to validate values in the UI before inserting into radcheck/radreply

**Phase:** Phase 2 (user/group management). Build the dictionary parser early; it informs the entire attribute editing UX.

**Confidence:** MEDIUM -- based on FreeRADIUS dictionary documentation and common patterns in existing UIs.

---

### TD-3: File-Based Config Without Validation Causes Outages

**What goes wrong:** The UI allows editing FreeRADIUS configuration files (modules, virtual servers, policies) through a web editor. A syntax error in the config file causes FreeRADIUS to fail on next restart or HUP, taking down authentication for the entire site.

**Why it happens:** FreeRADIUS configuration uses a custom syntax (not JSON, not YAML). There is no readily available parser for this format in Python or JavaScript. Developers implement a raw text editor without validation.

**Key behavior difference:**
- **HUP with bad config:** FreeRADIUS logs "HUP failed for module" and continues with OLD config. Changes don't apply but auth continues. Confusing but not an outage.
- **Full restart with bad config:** FreeRADIUS fails to start = COMPLETE OUTAGE.

**Prevention:**
1. **Pre-validation with `radiusd -XC`.** Before applying any config change, run `radiusd -XC` (check config mode) inside the FreeRADIUS container via Docker exec. Only proceed if it exits 0
2. **Config backup before every change.** Store the previous version so rollback is one click away
3. **Structured editing where possible.** For common modules (EAP, SQL), provide form-based editors that generate valid config. Reserve raw editing for advanced users with explicit "I know what I'm doing" confirmation
4. **Two-phase apply.** Write config -> validate (`-XC`) -> if valid, HUP/restart. If invalid, rollback and show error to user. Never leave an invalid config file on disk

**Phase:** Phase 4 (configuration management). Later-phase feature that needs careful design.

**Confidence:** HIGH -- `-XC` flag documented in FreeRADIUS man pages and FAQ.

---

## Integration Gotchas

Subtle issues at the boundaries between systems.

---

### IG-1: FreeRADIUS Column Names and PostgreSQL Case Folding

**What goes wrong:** FreeRADIUS PostgreSQL schema uses mixed-case column names like `UserName`, `AcctSessionId`, `NASIPAddress` in CREATE TABLE statements. PostgreSQL folds unquoted identifiers to lowercase. SQLAlchemy models that explicitly quote column names (`Column("UserName")`) may create case-sensitive references that don't match FreeRADIUS queries.

**Why it happens:** The FreeRADIUS `schema.sql` uses `UserName` (which PostgreSQL stores as `username` because it's unquoted), while `queries.conf` references `UserName` (also unquoted, so also `username`). Everything works. But if SQLAlchemy creates a table reflection with `Column("UserName", ...)` using explicit quoting, PostgreSQL treats it as case-sensitive "UserName" which does NOT match the `username` column.

**Prevention:**
1. **Match lowercase names in SQLAlchemy.** Use `Column("username")`, `Column("nasipaddress")`, etc. matching PostgreSQL's lowercase folding
2. **Use table reflection.** `Table("radcheck", metadata, autoload_with=engine)` gets the correct column names directly from PostgreSQL
3. **Test with real FreeRADIUS data.** Insert a user via the UI, authenticate via `radtest`, check that accounting data appears correctly in the UI
4. **Never rename FreeRADIUS columns.** Even via views. `queries.conf` references specific column names

**Phase:** Phase 1 (database models). Get this right in the initial SQLAlchemy table reflections.

**Confidence:** HIGH -- verified against official PostgreSQL schema.sql.

---

### IG-2: Simultaneous-Use Requires Three-Part Configuration

**What goes wrong:** Admin enables "Simultaneous-Use := 1" for a user via the UI, but double logins still occur. The feature silently does nothing.

**Why it happens:** Simultaneous-Use checking in SQL mode requires THREE things to all be configured, and missing any one causes silent failure:
1. `Simultaneous-Use := 1` in radcheck or radgroupcheck (the UI handles this)
2. The `sql` module uncommented in the `session {}` section of the virtual server config (file-level config)
3. The `simul_count_query` uncommented in the SQL module config (`mods-available/sql`)

Additionally, without accounting packets from the NAS, Simultaneous-Use cannot work at all -- there's no session data to count against.

**Double-login timing edge case:** Even when fully configured, two logins at exactly the same instant can both succeed because neither session is registered yet when the other is checked (NAS accounting delay).

**Prevention:**
1. **Bundle the full configuration.** When the UI enables Simultaneous-Use for a user, validate that the FreeRADIUS config files also have the session/sql module and simul_count_query enabled. If not, warn the admin with specific instructions
2. **Document prerequisites.** In the UI, when setting Simultaneous-Use, show: "Requires: (1) SQL session module enabled, (2) NAS sending accounting packets"
3. **Ship with correct defaults.** The FreeRADIUS container image should have `simul_count_query` and session-section SQL already uncommented

**Phase:** Phase 2 (user/group management attributes).

**Confidence:** HIGH -- confirmed by official FreeRADIUS tutorial.

**Sources:**
- [Simultaneous-Use documentation](https://www.freeradius.org/documentation/freeradius-server/3.2.9/howto/simultaneous_use.html)

---

### IG-3: Multi-Server Config File Synchronization Race Conditions

**What goes wrong:** Admin changes a configuration file (e.g., EAP settings) via the UI. The change is written to a Docker volume. Multiple FreeRADIUS containers may mount the same volume and read the file at different points during the write, getting partial/corrupt configuration. Or, if volumes are NOT shared, one server gets the change and others don't.

**Why it happens:** File writes are not atomic. Docker volume sharing across containers has no built-in locking. The UI writes the file, then sends HUP to each server sequentially, but there's a window where servers have inconsistent configs.

**Prevention:**
1. **Atomic write pattern.** Write to a temp file, then `rename()` (atomic on Linux). Only send HUP AFTER the rename completes
2. **Per-server config volumes (recommended).** Each FreeRADIUS container gets its own config volume. The backend writes to each independently, validates each with `radiusd -XC`, then sends HUP/restart to each
3. **Config version tracking.** Store a version number in a file within the config directory. After HUP, verify the correct version loaded
4. **Rollback on partial failure.** If server 1 reloads successfully but server 2 fails validation, decide: rollback server 1 for consistency, or accept inconsistency and show per-server status in the UI

**Phase:** Phase 4 (configuration management, multi-server). Designing this correctly is critical for multi-server reliability.

**Confidence:** MEDIUM -- based on distributed systems reasoning and Docker volume behavior.

---

### IG-4: Concurrent Database Access Between UI and FreeRADIUS

**What goes wrong:** Admin modifies a user's password in the UI while FreeRADIUS is processing an authentication request for that same user. The auth request uses the old password.

**Why it happens:** PostgreSQL MVCC provides snapshot isolation. FreeRADIUS queries see the database state at the start of their transaction, which may not include the UI's uncommitted or just-committed changes.

**Prevention:**
1. **This is expected behavior, not a bug.** FreeRADIUS handles this correctly via SQL transactions. Don't try to add locking or synchronization
2. **Show "changes take effect on next auth attempt" in the UI.** Set expectations correctly
3. **For immediate verification,** after saving, optionally trigger a test authentication via `radtest` or `radclient` to confirm the change works
4. **Do NOT cache FreeRADIUS table data aggressively on the backend.** Short TTL (5-10 seconds) or no cache

**Phase:** Phase 2 (user management). More of a UX consideration than a code fix.

**Confidence:** HIGH -- standard PostgreSQL MVCC behavior.

---

## Performance Traps

---

### PT-1: Dashboard Queries Hitting Live FreeRADIUS Tables

**What goes wrong:** The real-time dashboard ("active sessions", "auth stats", "traffic per NAS") runs complex aggregate queries directly against `radacct` and `radpostauth`. These queries compete with FreeRADIUS's own read/write operations, causing authentication latency spikes during dashboard refreshes.

**Why it happens:** It's the obvious implementation: `SELECT COUNT(*) FROM radacct WHERE AcctStopTime IS NULL GROUP BY NASIPAddress`. But this query scans the entire (potentially multi-million row) table and holds locks that conflict with FreeRADIUS's accounting writes.

**FreeRADIUS performance context:** FreeRADIUS handles ~2,000 packets/sec with a SQL backend. If the database takes more than ~1 millisecond to reply, it's too slow. Dashboard queries that take seconds will cascade into authentication failures.

**Prevention:**
1. **Read replica or materialized views.** Run dashboard queries against a PostgreSQL read replica, or use materialized views refreshed every 30-60 seconds
2. **Pre-aggregated stats table.** A background worker computes dashboard metrics every N seconds and writes to a `dashboard_stats` table. The API reads from this table, never from radacct directly
3. **Appropriate refresh intervals.** Active sessions: 30s is fine. Auth stats: 5-minute aggregation is sufficient. Traffic charts: 15-minute granularity. Don't poll radacct every second
4. **SSE over WebSocket for this use case.** Server-Sent Events are simpler than WebSocket for server-push dashboards (unidirectional data flow). Use polling as fallback

**Phase:** Phase 3 (dashboard). Design the data pipeline BEFORE building the UI.

**Confidence:** HIGH -- confirmed by InkBridge Networks article on database performance.

---

### PT-2: N+1 Queries on User Listing

**What goes wrong:** Listing users requires data from radcheck + radreply + radusergroup. Naive implementation queries radcheck for user list, then N queries for each user's reply attributes and group memberships. With 500 users, that's 1,500 queries per page load.

**Prevention:**
1. **Aggregate in SQL.** Use `LEFT JOIN` with `array_agg()` to get all data in 1-2 queries
2. **SQLAlchemy joinedload/subqueryload.** If using ORM relationships, configure eager loading
3. **Paginate all list endpoints.** Never return all users at once. Default page size: 25-50
4. **Add indexes.** Ensure `username` indexes exist on all RADIUS tables (they do in the default schema, but verify)

**Phase:** Phase 2 (user management). Must be correct from the first user listing implementation.

**Confidence:** HIGH -- standard web development issue.

---

### PT-3: Polling FreeRADIUS Container Health Too Aggressively

**What goes wrong:** Health monitoring polls Docker container stats (CPU, memory, restart count) every few seconds via the Docker API. Each poll goes through the socket proxy, adding overhead. With 3+ FreeRADIUS containers, this generates many API calls per interval.

**Prevention:**
1. **Poll container stats every 30 seconds maximum.** Container health doesn't change second-by-second
2. **Use Docker event stream.** Subscribe to container events (start, stop, die, health_status) via the Docker API's event endpoint instead of polling
3. **Cache stats in the backend.** Don't let every dashboard client trigger a Docker API call. Cache server-side with a TTL

**Phase:** Phase 3-4 (monitoring).

**Confidence:** MEDIUM -- standard Docker API best practices.

---

## Security Mistakes

---

### SM-1: JWT Algorithm Confusion and Weak Secrets

**What goes wrong:** The JWT implementation accepts the `alg` header from the token itself, allowing algorithm substitution attacks. Or the signing secret is a short string like `"secret"` or `"radius-ui-key"` that can be brute-forced.

**Specific attacks:**
- **None algorithm:** Attacker sets `alg: "none"`, removes signature, modifies role to admin
- **RS256 to HS256 confusion:** Attacker switches to HS256 and signs with the RSA public key (which is public)
- **Brute-force:** Weak HMAC secrets cracked with `jwt-cracker` or `hashcat`

**Prevention:**
1. **Whitelist algorithms explicitly.** In PyJWT: `jwt.decode(token, key, algorithms=["HS256"])` -- NEVER omit the `algorithms` parameter
2. **Generate secrets with `secrets.token_hex(32)`.** Minimum 256-bit entropy. Store in environment variable, never in code
3. **Short token lifetime.** Access tokens: 15 minutes. Refresh tokens: 7 days with rotation
4. **Refresh token rotation.** Each refresh issues a new refresh token and invalidates the old one. Detect reuse (indicates theft) and revoke entire token family
5. **Token revocation list.** Maintain a Redis/DB-backed blocklist for revoked tokens (logout, password change, role change)
6. **Never use python-jose.** It is abandoned/unmaintained. Use PyJWT

**Phase:** Phase 1 (authentication). Security foundation must be solid from the start.

**Confidence:** HIGH -- OWASP, PortSwigger, PyJWT documentation.

**Sources:**
- [JWT attacks - PortSwigger](https://portswigger.net/web-security/jwt)
- [JWT Security Best Practices - Authgear](https://www.authgear.com/post/jwt-security-best-practices-common-vulnerabilities)

---

### SM-2: RBAC Bypass Through Direct API Manipulation

**What goes wrong:** The UI hides buttons based on role (e.g., Operators can't see "Delete User"), but the API endpoint `/api/users/{id}` doesn't check permissions. An Operator sends a DELETE request via curl and it succeeds.

**Why it happens:** RBAC is implemented in the frontend (UI visibility) but not in the backend (API authorization).

**Prevention:**
1. **Backend-first RBAC.** Every API endpoint has a permission dependency: `Depends(require_role(["super_admin", "admin"]))`. The frontend RBAC is cosmetic convenience only
2. **Permission matrix as code.** Define a single source of truth for role-endpoint permissions
3. **Automated RBAC tests.** For every endpoint, test that each role either succeeds or gets 403
4. **Separate permission for destructive operations.** Delete user, modify NAS secrets, restart FreeRADIUS -- Admin+ regardless of general endpoint permissions

**Phase:** Phase 1-2 (authentication and authorization). RBAC middleware must exist before any protected endpoint is built.

**Confidence:** HIGH -- standard web security best practice.

---

### SM-3: Certificate Management File Permissions

**What goes wrong:** The UI generates or uploads TLS/EAP certificates and writes them to the FreeRADIUS container's cert directory. FreeRADIUS refuses to start because the cert directory is world-readable or owned by the wrong UID.

**Why it happens:** FreeRADIUS enforces strict file permissions on certificate directories: they MUST be owned by the FreeRADIUS UID, and the server runs `chmod go-rwx` on the directory at startup. Docker volume mounts may not preserve correct ownership.

**Prevention:**
1. **Match UIDs.** Ensure the backend writes certs with the same UID/GID that FreeRADIUS runs as inside its container (typically `freerad:freerad` or `radiusd:radiusd`)
2. **Post-write permission fix.** After writing cert files, exec into the FreeRADIUS container to set correct ownership and permissions
3. **Separate cert volume.** Mount a dedicated volume for certificates, not shared with other config
4. **Never use public CAs for EAP.** Use self-signed or private CA certificates for 802.1X. Trusting public CAs means any cert signed by that CA is trusted

**Phase:** Phase 4-5 (certificate management).

**Confidence:** HIGH -- confirmed by FreeRADIUS EAP-TLS documentation.

---

## UX Pitfalls

---

### UX-1: Exposing RADIUS Internals Instead of Domain Concepts

**What goes wrong:** The UI mirrors the database schema: separate pages for "radcheck", "radreply", "radgroupcheck", "radgroupreply", "radusergroup". Network admins don't think in these terms. They think: "Create a user, assign them to a VLAN, set a bandwidth limit, put them in a group."

**Why it happens:** Developers build CRUD interfaces for each database table because it's the fastest path to "feature complete." daloRADIUS made this exact mistake and every admin who used it suffered through it.

**Consequences:**
- Admins must understand FreeRADIUS internals to use the UI, defeating the purpose
- Errors are common: admin puts a reply attribute in radcheck, or uses wrong operator
- The UI feels like phpMyAdmin for RADIUS, not a management tool

**Prevention:**
1. **Task-oriented interface.** "Create User" is one form that writes to radcheck (password), radreply (attributes), and radusergroup (group membership) in a single transaction
2. **Profile/template system.** Define "WiFi Basic" profile = {VLAN 100, 10Mbps bandwidth, 1 hour session timeout}. Assigning a user to this profile writes the correct attributes with correct operators automatically
3. **Hide the operator column.** The UI should choose the correct operator based on context. Advanced users can see it in an "expert mode" toggle
4. **Domain vocabulary in the UI.** "VLAN Assignment" not "Tunnel-Private-Group-Id". "Bandwidth Limit" not "Mikrotik-Rate-Limit". Map RADIUS attributes to human-readable labels

**Phase:** Phase 2 (user/group management). This is a UX design decision that must be made BEFORE building the interface.

**Confidence:** HIGH -- based on daloRADIUS user complaints and UX principles.

---

### UX-2: No Indication of Pending vs Applied Changes

**What goes wrong:** Admin changes a configuration file or adds a NAS device. The UI shows "Saved!" but doesn't indicate that FreeRADIUS hasn't been reloaded yet. The change exists in the database or on disk but isn't active. Admin doesn't understand why nothing changed.

**Why it happens:** Web UIs typically save = done. In FreeRADIUS management, save = stored, but applying requires a reload/restart. This two-step process is unfamiliar to web developers.

**Critical distinction the UI must communicate:**
- **SQL changes (users, groups, attributes):** Effective on next RADIUS request. No reload needed.
- **NAS table changes:** Require full FreeRADIUS restart (not just HUP).
- **Config file changes (modules, policies):** Require HUP or restart.

**Prevention:**
1. **Visual state machine.** Show clear indicators: Draft -> Saved -> Applied (with green/yellow/blue badges)
2. **Pending changes banner.** When unapplied changes exist, show persistent banner: "3 changes pending. Restart FreeRADIUS to apply." with an "Apply Now" button
3. **Per-server status.** In multi-server mode, show which servers have the latest changes: "Server Paris: up to date. Server Lyon: 2 pending changes"
4. **Auto-categorize changes.** SQL user/group changes don't need a banner (instant). NAS and config changes DO

**Phase:** All phases. This UX pattern must be consistent across every feature that modifies FreeRADIUS behavior.

**Confidence:** HIGH -- fundamental UX issue for infrastructure management tools.

---

### UX-3: Overwhelming Dashboards With Irrelevant Metrics

**What goes wrong:** The dashboard shows 30 metrics at once. Network admins can't quickly answer: "Is everything OK?"

**Prevention:**
1. **Three-tier information hierarchy:**
   - **Glance (2 seconds):** Overall health status per server (green/yellow/red). Total active sessions. Failed auth rate
   - **Investigate (30 seconds):** Per-NAS breakdown, authentication trends, recent errors
   - **Deep dive (minutes):** Full session table, log search, accounting details
2. **Alert-driven, not metric-driven.** Show alerts for anomalies (auth failure spike, server down, certificate expiring) rather than raw numbers
3. **Contextual metrics.** Show "Failed auths: 12 (normal: 5-15)" not just "Failed auths: 12". Without baseline context, a number is meaningless

**Phase:** Phase 3 (dashboard design). Design the information hierarchy before choosing charts.

**Confidence:** MEDIUM -- based on dashboard design best practices.

---

## "Looks Done But Isn't" Checklist

Things that pass a demo but fail in production.

| Feature | What's Missing | Why It Matters |
|---------|---------------|----------------|
| User creation | Operator validation on radcheck/radreply inserts | Wrong operator = silent auth failure |
| NAS management | Restart-after-change workflow | New NAS is invisible to FreeRADIUS until restart |
| Config file editing | `radiusd -XC` pre-validation | Syntax error on restart = authentication outage |
| Active sessions dashboard | Separate from radacct aggregation | Direct radacct queries kill DB performance at scale |
| Simultaneous-Use | Session module + simul_count_query config check | Feature silently does nothing without both |
| Certificate management | File permission enforcement (chmod go-rwx) | FreeRADIUS refuses to start if cert dir is world-readable |
| Multi-server config push | Atomic write + per-server validation | Partial write = corrupt config = outage |
| User deletion | Cascade to radreply + radusergroup + close sessions | Orphaned rows cause ghost sessions and stale data |
| Group deletion | Check for users still assigned | Deleting a group removes assigned users' attributes silently |
| Password change | Notification about existing sessions | Old sessions continue until NAS accounting timeout |
| RBAC role change | JWT still valid until expiry | Demoted admin retains access until token expires |
| Audit log | Include RADIUS-level events (radpostauth) | Without radpostauth correlation, audit trail is incomplete |
| Backup/restore | Include both app DB + FreeRADIUS config files | Missing either one = incomplete restore |
| Docker restart | Graceful shutdown for in-flight requests | Hard kill drops active authentication mid-request |
| Secret rotation | Both NAS table update AND NAS device reconfiguration | Half-rotated secret = auth failure from that NAS |

---

## Pitfall-to-Phase Mapping

| Phase | Topic | Pitfall | Severity | Mitigation |
|-------|-------|---------|----------|------------|
| 1 | Database setup | CP-1: Schema ownership conflict | CRITICAL | Separate PostgreSQL schemas, Alembic filters |
| 1 | Database setup | TD-1: radacct unbounded growth | HIGH | Partition from day one with pg_partman |
| 1 | Database models | IG-1: Column name case folding | HIGH | Use table reflection, match lowercase |
| 1 | Docker infrastructure | CP-4: Socket exposure | CRITICAL | Socket proxy from day one |
| 1 | Authentication | SM-1: JWT algorithm confusion | HIGH | Whitelist algorithms, strong secrets |
| 1 | Authorization | SM-2: RBAC bypass | HIGH | Backend-first RBAC middleware |
| 2 | User/group CRUD | CP-2: Operator misuse | CRITICAL | Validation layer, context-aware defaults |
| 2 | User/group UX | UX-1: Exposing RADIUS internals | HIGH | Task-oriented interface, profiles |
| 2 | NAS management | CP-3: NAS requires restart | HIGH | Restart workflow, clear UI feedback |
| 2 | NAS management | CP-6: Secret exposure | HIGH | Write-only secrets, API filtering |
| 2 | Password storage | CP-7: Cleartext passwords | HIGH | Document tradeoffs, suggest NT-Password |
| 2 | Attributes | TD-2: Hardcoded attribute names | MEDIUM | Dictionary parser, autocomplete |
| 2 | Simultaneous-Use | IG-2: Three-part config requirement | MEDIUM | Prerequisite validation, bundled config |
| 2 | User listing | PT-2: N+1 queries | MEDIUM | Joined queries, pagination |
| 3 | Dashboard | PT-1: Dashboard query performance | HIGH | Materialized views, pre-aggregation |
| 3 | Service control | CP-5: HUP memory leak | HIGH | Batch reloads, prefer restart |
| 3 | Monitoring | PT-3: Aggressive health polling | MEDIUM | Event streams, 30s intervals |
| 3 | Dashboard UX | UX-3: Metric overload | MEDIUM | Three-tier information hierarchy |
| 4 | Config management | TD-3: Config without validation | HIGH | radiusd -XC pre-validation |
| 4 | Multi-server sync | IG-3: Race conditions | MEDIUM | Atomic writes, per-server volumes |
| 4-5 | Certificates | SM-3: File permissions | HIGH | UID matching, post-write chmod |
| All | Change management | UX-2: Pending vs applied states | HIGH | Visual state machine, pending banner |
| All | Concurrent access | IG-4: UI vs FreeRADIUS timing | LOW | Set expectations in UI, no code fix needed |

---

## Sources

### Official Documentation
- [FreeRADIUS PostgreSQL Schema (v3.2.x)](https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-config/sql/main/postgresql/schema.sql)
- [FreeRADIUS Operators Wiki](https://wiki.freeradius.org/config/Operators)
- [FreeRADIUS SQL HOWTO](https://wiki.freeradius.org/guide/SQL-HOWTO)
- [FreeRADIUS FAQ](https://wiki.freeradius.org/guide/FAQ)
- [FreeRADIUS Simultaneous-Use](https://www.freeradius.org/documentation/freeradius-server/3.2.9/howto/simultaneous_use.html)
- [FreeRADIUS EAP-TLS Tutorial](https://www.freeradius.org/documentation/freeradius-server/3.2.9/tutorials/eap-tls.html)
- [FreeRADIUS clients.conf Reference](https://www.freeradius.org/documentation/freeradius-server/4.0.0/reference/raddb/clients.conf.html)
- [FreeRADIUS Dictionary Documentation](https://www.freeradius.org/documentation/freeradius-server/3.2.9/tutorials/dictionary.html)
- [Alembic autogenerate include_object](https://alembic.sqlalchemy.org/en/latest/autogenerate.html#controlling-what-to-be-autogenerated)

### GitHub Issues
- [#5490 Memory leak on HUP reload](https://github.com/FreeRADIUS/freeradius-server/issues/5490)
- [#5628 PostgreSQL performance degradation](https://github.com/FreeRADIUS/freeradius-server/issues/5628)
- [#2846 File change reload not working](https://github.com/FreeRADIUS/freeradius-server/issues/2846)
- [#576 daloRADIUS VLAN assignment issue](https://github.com/lirantal/daloradius/issues/576)

### Security References
- [Docker Security - OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Protect Docker daemon socket - Docker Docs](https://docs.docker.com/engine/security/protect-access/)
- [JWT attacks - PortSwigger](https://portswigger.net/web-security/jwt)
- [Making RADIUS More Secure - InkBridge Networks](https://www.inkbridgenetworks.com/blog/blog-10/making-radius-more-secure-76)
- [JWT Security Best Practices - Authgear](https://www.authgear.com/post/jwt-security-best-practices-common-vulnerabilities)

### Community and Tools
- [Tecnativa docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)
- [wollomatic/socket-proxy](https://github.com/wollomatic/socket-proxy)
- [daloRADIUS issues](https://github.com/lirantal/daloradius/issues)
- [FreeRADIUS-NAS-change-restarter](https://github.com/jda/FreeRADIUS-NAS-change-restarter)
- [InkBridge: My FreeRADIUS server is slow](https://www.inkbridgenetworks.com/blog/blog-10/my-freeradius-server-is-slow-what-s-wrong-97)
- [NAS from DB discussion](https://freeradius-users.freeradius.narkive.com/arkSZbSE/nas-from-db-add-without-restart)
