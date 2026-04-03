# Architecture Patterns

**Domain:** Multi-server FreeRADIUS web management system
**Researched:** 2026-04-03
**Confidence:** HIGH (verified against FreeRADIUS official docs, Docker SDK docs, PostgreSQL docs, OpenWISP/daloRADIUS reference architectures)

---

## System Overview

```
                        +--------------------+
                        |   Browser Client   |
                        |  (Next.js 15 SSR)  |
                        +--------+-----------+
                                 |
                                 | HTTPS (port 3000)
                                 |
                        +--------v-----------+
                        |   Next.js Frontend |
                        |   (App Router/SSR) |
                        |   Docker Container |
                        +--------+-----------+
                                 |
                                 | HTTP REST + WebSocket/SSE
                                 | (internal Docker network)
                                 |
                        +--------v-----------+
                        |   FastAPI Backend   |
                        |   (Python async)    |
                        |   Docker Container  |
                        +---+------+------+--+
                            |      |      |
            +---------------+      |      +---------------+
            |                      |                      |
   +--------v--------+   +--------v--------+   +---------v-------+
   | Docker Socket    |   | PostgreSQL 16   |   | Shared Volumes  |
   | (/var/run/docker |   | (port 5432)     |   | (raddb configs) |
   |  .sock)          |   | Docker Container|   |                 |
   +--------+---------+   +--------+--------+   +---+----+----+--+
            |                      |                 |    |    |
   +--------v--------+   +--------+--------+   +----+  +-+  ++---+
   | Signal Control   |   |                 |   |    |  | |  |    |
   | HUP / restart    |   |                 |   |    v  | v  v    |
   +--+-----+-----+--+   v                 v   |  +-+--+-+--+-+  |
      |     |     |    +----------+  +------+-+ |  | raddb vols | |
      v     v     v    | radius   |  | app    | |  | (per inst) | |
   +--+--+--+--+--+-+  | schema   |  | schema | |  +------------+ |
   | FR1 | FR2 | FR3 | | radcheck |  | users  | |                 |
   |     |     |     | | radreply |  | roles  | |                 |
   +-----+-----+-----+ | radacct  |  | audit  | |                 |
   FreeRADIUS instances | nas ...  |  | ...    | |                 |
   (Docker containers)  +----------+  +--------+ |                 |
                                                  |                 |
   +----------------------------------------------+-----------------+
   |              raddb/ per instance (in shared volume)            |
   |  radiusd.conf, mods-available/, mods-enabled/,                |
   |  sites-available/, sites-enabled/, certs/, mods-config/       |
   +---------------------------------------------------------------+
```

### Key Architectural Decisions

1. **Shared Database, Separate Schemas**: FastAPI and FreeRADIUS share one PostgreSQL instance but use separate schemas (`radius` and `app`). FreeRADIUS reads/writes `radius.*` tables via its SQL module. The backend reads/writes both schemas. No synchronization layer needed -- SQL changes are immediately visible to FreeRADIUS on the next auth request.

2. **Docker Socket for Service Control**: The backend mounts the Docker socket to send signals (SIGHUP for reload, restart for config changes that SIGHUP cannot handle). No custom agent inside FreeRADIUS containers.

3. **Real-Time via SSE or WebSocket**: Server-Sent Events for one-way dashboard updates (simpler, auto-reconnects). WebSocket reserved for bidirectional needs (if any emerge). SSE is the default recommendation for v1.

4. **Shared Volumes for Config**: FreeRADIUS file-based configuration (modules, virtual servers, policies, certs) lives on Docker named volumes shared between the backend and each FreeRADIUS instance. Backend writes files, then signals the container.

5. **Server-Scoped API Routes**: All FreeRADIUS-related endpoints are prefixed with `/servers/{server_id}/` to enforce multi-server awareness at the API layer.

---

## Component Boundaries

### 1. Next.js Frontend (Presentation Layer)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | UI rendering, SSR, client-side interactivity, routing, form validation |
| **Communicates With** | FastAPI Backend (REST + SSE/WebSocket) |
| **Does NOT** | Access database directly, talk to Docker, touch FreeRADIUS configs |
| **Technology** | Next.js 15 App Router, React Server Components, shadcn/ui, Recharts |

The frontend is a pure consumer of the backend API. It never bypasses the backend to access the database or Docker. This is a strict boundary: the frontend knows about RADIUS concepts (users, groups, NAS, sessions) but not about how they are stored or which FreeRADIUS instance serves them.

**Key architectural decisions:**
- Server Components for data-fetching pages (dashboard, lists, detail views)
- Client Components only for interactive elements (forms, real-time charts, modals)
- No heavy global state store; use React Server Components for server data, minimal client state (Zustand for UI-only state like sidebar collapse, selected server, theme)
- Route groups for logical separation: `(auth)`, `(dashboard)`
- JWT access token in memory, refresh token in httpOnly cookie

### 2. FastAPI Backend (Business Logic + Orchestration Layer)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Authentication, authorization, CRUD operations, FreeRADIUS orchestration, config file management, real-time data streaming |
| **Communicates With** | PostgreSQL (SQLAlchemy), Docker daemon (docker-py), FreeRADIUS config volumes (filesystem), Frontend (REST + SSE) |
| **Does NOT** | Render UI, serve static files (let Next.js handle that) |
| **Technology** | FastAPI, SQLAlchemy 2.x (async), docker-py, Pydantic v2 |

This is the critical orchestration layer. It is the **only** component that:
1. Writes to FreeRADIUS SQL tables (radcheck, radreply, etc.)
2. Manages FreeRADIUS config files (via mounted volumes)
3. Controls FreeRADIUS container lifecycle (via Docker socket)
4. Enforces RBAC on every operation

### 3. PostgreSQL Database (Persistence Layer)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Persistent storage for both FreeRADIUS operational data and application data |
| **Communicates With** | FastAPI Backend (SQLAlchemy/asyncpg), FreeRADIUS instances (rlm_sql/libpq) |
| **Does NOT** | Enforce business logic (that is the backend's job) |
| **Technology** | PostgreSQL 16 |

### 4. FreeRADIUS Instances (RADIUS Protocol Layer)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | RADIUS authentication, authorization, accounting (AAA) |
| **Communicates With** | PostgreSQL (rlm_sql), NAS devices (RADIUS protocol, UDP 1812/1813) |
| **Does NOT** | Expose HTTP APIs, talk to the backend directly |
| **Technology** | FreeRADIUS 3.2.x in Docker containers |

Each FreeRADIUS instance is an independent RADIUS server. All instances share the same PostgreSQL database (same users, same groups). Instance-specific NAS assignments use the `server` column in the `nas` table.

### 5. Docker Infrastructure (Orchestration Layer)

| Aspect | Detail |
|--------|--------|
| **Responsibility** | Container lifecycle, networking, volume management |
| **Communicates With** | All containers via Docker daemon |
| **Technology** | Docker Compose, Docker Engine API |

---

## Database Architecture: Dual-Schema Design

Use PostgreSQL schemas to logically separate concerns while maintaining a single database connection:

```sql
-- Schema 1: FreeRADIUS tables (initialized from official schema.sql, NEVER by Alembic)
CREATE SCHEMA radius;

-- Schema 2: Application tables (managed by Alembic migrations)
CREATE SCHEMA app;
```

### FreeRADIUS Schema (`radius.*`)

These tables are defined by the official FreeRADIUS PostgreSQL schema. The exact column definitions:

| Table | Columns | Purpose |
|-------|---------|---------|
| `radcheck` | id (serial PK), UserName (text), Attribute (text), op (varchar(2)), Value (text) | Per-user authentication attributes (passwords) |
| `radreply` | id (serial PK), UserName (text), Attribute (text), op (varchar(2)), Value (text) | Per-user reply attributes (IP, bandwidth) |
| `radgroupcheck` | id (serial PK), GroupName (text), Attribute (text), op (varchar(2)), Value (text) | Per-group authentication attributes |
| `radgroupreply` | id (serial PK), GroupName (text), Attribute (text), op (varchar(2)), Value (text) | Per-group reply attributes |
| `radusergroup` | id (serial PK), UserName (text), GroupName (text), priority (int) | User-to-group membership |
| `radacct` | RadAcctId (bigserial PK), AcctSessionId, AcctUniqueId, UserName, NASIPAddress (inet), AcctStartTime, AcctStopTime, AcctSessionTime, AcctInputOctets, AcctOutputOctets, ... (29 columns) | Accounting records (sessions) |
| `radpostauth` | id (bigserial PK), username, pass, reply, CalledStationId, CallingStationId, authdate, Class | Auth attempt logs |
| `nas` | id (serial PK), nasname (text), shortname (text), type (text), ports (int), secret (text), server (text), community (text), description (text) | NAS device definitions |
| `nasreload` | NASIPAddress (inet PK), ReloadTime (timestamptz) | Reload tracking |

**Critical operator semantics:**
- `:=` -- Set attribute unconditionally (used for Cleartext-Password, NT-Password)
- `==` -- Check: attribute must equal value (used for checking conditions)
- `=` -- Set in reply only if not already set (used for reply attributes)
- `+=` -- Append to existing attributes

### Application Schema (`app.*`)

| Table | Purpose |
|-------|---------|
| `app.users` | Admin users who log into the management UI |
| `app.roles` | Role definitions (or use enum in users table) |
| `app.audit_log` | Every admin action logged with actor, action, target, timestamp |
| `app.server_registry` | Registered FreeRADIUS instances (name, docker container ID, description, location) |
| `app.dashboard_metrics` | Pre-computed stats for dashboard performance |

### Why Two Schemas

1. **FreeRADIUS owns its schema**: The `schema.sql` defines exact structures with PascalCase columns (UserName, not username). Do not fight these conventions.
2. **Migration safety**: Alembic manages `app.*` only. Zero risk of corrupting FreeRADIUS tables during autogenerate.
3. **Clear ownership boundary**: If FreeRADIUS upgrades its schema, you update `schema.sql`. If the app needs new tables, you write an Alembic migration.

### SQLAlchemy Implementation

```python
# models/radius.py -- READ the existing FreeRADIUS schema, do NOT migrate
from sqlalchemy import Column, Integer, String, Text, BigInteger
from sqlalchemy.orm import DeclarativeBase

class RadiusBase(DeclarativeBase):
    __abstract__ = True

class RadCheck(RadiusBase):
    __tablename__ = 'radcheck'
    __table_args__ = {'schema': 'radius'}
    id = Column(Integer, primary_key=True)
    username = Column('UserName', Text, nullable=False, default='')
    attribute = Column('Attribute', Text, nullable=False, default='')
    op = Column(String(2), nullable=False, default='==')
    value = Column('Value', Text, nullable=False, default='')

# models/app.py -- managed by Alembic
class AppBase(DeclarativeBase):
    __abstract__ = True

class AppUser(AppBase):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'app'}
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default='viewer')
```

### Alembic Configuration

Only target the `app` schema. Exclude `radius` schema from autogenerate:

```python
# alembic/env.py
def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name == "app"
    return True

context.configure(
    target_metadata=AppBase.metadata,
    include_schemas=True,
    include_name=include_name,
)
```

### FreeRADIUS SQL Module Config

```
sql {
    driver = "rlm_sql_postgresql"
    server = "postgres"
    port = 5432
    login = "radius"
    password = "..."
    radius_db = "radiusdb"
    schema = "radius"
}
```

---

## Recommended Project Structure

```
radius-ui/
+-- docker-compose.yml              # 6 services orchestration
+-- docker-compose.override.yml     # Dev overrides (hot-reload, debug ports)
|
+-- frontend/                       # Next.js 15 application
|   +-- Dockerfile
|   +-- next.config.ts
|   +-- package.json
|   +-- src/
|       +-- app/                    # App Router pages
|       |   +-- (auth)/             # Route group: login, forgot-password
|       |   |   +-- login/
|       |   |   +-- layout.tsx      # Auth layout (centered, no sidebar)
|       |   +-- (dashboard)/        # Route group: main app
|       |   |   +-- layout.tsx      # Dashboard layout (sidebar + header)
|       |   |   +-- page.tsx        # Dashboard home (overview stats)
|       |   |   +-- servers/
|       |   |   |   +-- [serverId]/
|       |   |   |       +-- users/          # RADIUS users
|       |   |   |       |   +-- page.tsx    # User list (Server Component)
|       |   |   |       |   +-- [id]/       # User detail
|       |   |   |       |   +-- new/        # Create user
|       |   |   |       +-- groups/         # RADIUS groups
|       |   |   |       +-- nas/            # NAS devices
|       |   |   |       +-- sessions/       # Active sessions (SSE)
|       |   |   |       +-- logs/           # Auth logs, accounting
|       |   |   |       +-- config/         # File-based config editor
|       |   |   |       +-- status/         # Health, metrics
|       |   |   +-- settings/       # App settings, admin user management
|       |   +-- api/                # Next.js API routes (BFF proxy if needed)
|       |   +-- layout.tsx          # Root layout
|       |   +-- globals.css         # Tailwind styles
|       +-- components/
|       |   +-- ui/                 # shadcn/ui primitives
|       |   +-- layout/             # Sidebar, Header, Breadcrumbs, ServerSelector
|       |   +-- features/           # Feature-specific components
|       |       +-- users/          # UserTable, UserForm, UserCard
|       |       +-- sessions/       # SessionTable, LiveSessionChart
|       |       +-- servers/        # ServerStatusCard, ConfigEditor
|       |       +-- dashboard/      # StatCard, TrafficChart
|       +-- lib/
|       |   +-- api-client.ts       # Typed fetch wrapper for backend API
|       |   +-- auth.ts             # JWT handling, auth context
|       |   +-- sse.ts              # SSE client manager
|       |   +-- utils.ts            # Shared utilities
|       +-- hooks/
|       |   +-- use-sessions.ts     # SSE hook for live sessions
|       |   +-- use-auth.ts         # Auth state hook
|       |   +-- use-server.ts       # Current server context
|       +-- stores/
|       |   +-- ui-store.ts         # Zustand: sidebar, theme, selected server
|       +-- types/
|           +-- radius.ts           # RADIUS domain types
|           +-- api.ts              # API response types
|
+-- backend/                        # FastAPI application
|   +-- Dockerfile
|   +-- pyproject.toml
|   +-- alembic/                    # Database migrations (app schema only)
|   |   +-- versions/
|   |   +-- env.py                  # Configured to target only 'app' schema
|   +-- alembic.ini
|   +-- app/
|       +-- main.py                 # FastAPI app factory, lifespan events
|       +-- api/
|       |   +-- v1/
|       |   |   +-- router.py       # Aggregates all v1 routers
|       |   |   +-- auth.py         # POST /auth/login, /auth/refresh
|       |   |   +-- users.py        # CRUD /servers/{id}/users
|       |   |   +-- groups.py       # CRUD /servers/{id}/groups
|       |   |   +-- nas.py          # CRUD /servers/{id}/nas
|       |   |   +-- sessions.py     # GET /servers/{id}/sessions, SSE /servers/{id}/events
|       |   |   +-- logs.py         # GET /servers/{id}/logs/auth, /logs/accounting
|       |   |   +-- servers.py      # GET/POST /servers, /servers/{id}/reload, /servers/{id}/restart
|       |   |   +-- config.py       # GET/PUT /servers/{id}/config/{path}
|       |   |   +-- dashboard.py    # GET /dashboard/stats
|       |   +-- deps.py             # Dependency injection (DB session, current user, server)
|       +-- core/
|       |   +-- config.py           # Settings from environment (Pydantic BaseSettings)
|       |   +-- security.py         # JWT encode/decode, password hashing (argon2)
|       |   +-- rbac.py             # Role-based permission checker
|       |   +-- database.py         # Async SQLAlchemy engine + session factory
|       |   +-- docker_client.py    # Docker SDK singleton
|       +-- models/
|       |   +-- radius.py           # SQLAlchemy models for radius.* tables (no Alembic)
|       |   +-- app.py              # SQLAlchemy models for app.* tables (Alembic managed)
|       +-- schemas/                # Pydantic request/response models
|       |   +-- auth.py
|       |   +-- user.py
|       |   +-- group.py
|       |   +-- nas.py
|       |   +-- session.py
|       |   +-- server.py
|       +-- services/               # Business logic layer
|       |   +-- radius_user.py      # User CRUD with radcheck/radreply/radusergroup
|       |   +-- radius_group.py     # Group management with operator semantics
|       |   +-- radius_nas.py       # NAS device management
|       |   +-- config_manager.py   # Read/write/validate raddb config files
|       |   +-- docker_manager.py   # Container lifecycle (HUP, restart, status, logs)
|       |   +-- session_monitor.py  # Poll radacct + stream via SSE
|       |   +-- audit.py            # Log admin actions to app.audit_log
|       +-- middleware/
|           +-- audit.py            # Audit logging middleware
|           +-- cors.py             # CORS configuration
|
+-- freeradius/                     # FreeRADIUS Docker setup
|   +-- Dockerfile                  # Based on freeradius/freeradius-server
|   +-- raddb-templates/            # Base configuration templates
|   |   +-- radiusd.conf
|   |   +-- mods-available/
|   |   |   +-- sql                 # SQL module config (PostgreSQL, radius schema)
|   |   |   +-- eap                 # EAP configuration
|   |   +-- sites-available/
|   |   |   +-- default
|   |   |   +-- inner-tunnel
|   |   +-- clients.conf            # Template with env-based secrets
|   +-- scripts/
|       +-- entrypoint.sh           # Init script: copy templates if empty, start radiusd
|
+-- database/                       # Database initialization
|   +-- init/
|   |   +-- 01-create-schemas.sql   # CREATE SCHEMA radius; CREATE SCHEMA app;
|   |   +-- 02-radius-schema.sql    # FreeRADIUS official schema.sql (targeting radius schema)
|   |   +-- 03-seed-data.sql        # Default NAS entries, test users
|
+-- volumes/                        # Docker volume mount points (dev only)
|   +-- raddb-server1/
|   +-- raddb-server2/
|   +-- raddb-server3/
|
+-- .planning/                      # Project planning (GSD)
+-- docs/                           # Documentation
```

---

## Architectural Patterns to Follow

### Pattern 1: Service Layer for RADIUS Operations

**What:** RADIUS operations (create user, assign to group, set attributes) involve multiple table writes with specific operator semantics. A service layer encapsulates this complexity.

**When:** Any RADIUS user/group CRUD operation.

**Why:** Creating a "RADIUS user" is not just an INSERT into radcheck. It requires: an entry in radcheck with `Cleartext-Password` (op `:=`), optional entries in radreply for attributes, an entry in radusergroup for group membership. The service layer makes this a single method call.

```python
class RadiusUserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, username: str, password: str,
                          group: str | None = None,
                          reply_attrs: dict | None = None) -> dict:
        # 1. radcheck: authentication
        check = RadCheck(username=username, attribute='Cleartext-Password',
                         op=':=', value=password)
        self.db.add(check)

        # 2. radreply: authorization attributes
        if reply_attrs:
            for attr_name, attr_value in reply_attrs.items():
                reply = RadReply(username=username, attribute=attr_name,
                                 op='=', value=attr_value)
                self.db.add(reply)

        # 3. radusergroup: group membership
        if group:
            membership = RadUserGroup(username=username, groupname=group, priority=0)
            self.db.add(membership)

        await self.db.commit()
```

**Note:** SQL changes are immediately effective. FreeRADIUS reads SQL tables on every authentication request. No SIGHUP or restart needed for user/group/NAS changes.

### Pattern 2: Server-Scoped Routes

**What:** All FreeRADIUS-related endpoints are prefixed with `/servers/{server_id}/`.

**When:** Any endpoint that touches FreeRADIUS data or containers.

**Why:** Multi-server support requires every operation to be scoped to a specific server. Prevents accidental cross-server operations and makes the API self-documenting.

```python
router = APIRouter(prefix="/servers/{server_id}/users")

@router.get("/")
async def list_users(
    server_id: int,
    server: ServerRecord = Depends(get_server),
    current_user: AppUser = Depends(require_role(Role.VIEWER)),
):
    service = RadiusUserService(db)
    return await service.list_users()
```

### Pattern 3: Docker Socket for Container Control

**What:** The backend manages FreeRADIUS containers via the Docker Engine API.

**When:** Reload config (SIGHUP), restart server, check health, read logs.

**Why:** No custom agent needed inside FreeRADIUS containers. The Docker API provides signal sending, container lifecycle, stats, and log streaming out of the box.

```python
import docker

class DockerManager:
    def __init__(self):
        self.client = docker.from_env()
        self._label_filter = {"label": "radius-ui.role=freeradius"}

    def get_servers(self) -> list[dict]:
        containers = self.client.containers.list(all=True, filters=self._label_filter)
        return [self._to_status(c) for c in containers]

    def reload_config(self, container_id: str, force_restart: bool = False):
        container = self.client.containers.get(container_id)
        if force_restart:
            container.restart(timeout=10)
        else:
            container.kill(signal='SIGHUP')

    def get_stats(self, container_id: str) -> dict:
        container = self.client.containers.get(container_id)
        return container.stats(stream=False)
```

**Docker Compose labeling for discovery:**
```yaml
services:
  freeradius-1:
    labels:
      - "radius-ui.role=freeradius"
      - "radius-ui.server-id=server-1"
      - "radius-ui.display-name=Paris - Gare du Nord"
```

**Critical: SIGHUP vs. Restart.** FreeRADIUS SIGHUP reloads some modules and virtual servers, but NOT all. The EAP module notably requires a full restart. The backend must track which config changes need HUP vs. full restart:

| Config Area | Reload Method |
|-------------|---------------|
| clients.conf, users file | SIGHUP |
| sites-available/* (virtual servers) | SIGHUP |
| Most mods-available/* | SIGHUP |
| mods-available/eap | **Full restart** |
| mods-available/sql | **Full restart** |
| radiusd.conf | **Full restart** |
| Certificate changes | **Full restart** |

### Pattern 4: Config File Management via Shared Volumes

**What:** FreeRADIUS file-based config is managed by the backend through Docker named volumes.

**When:** Admin edits EAP settings, enables/disables a module, modifies a virtual server.

```yaml
# docker-compose.yml
services:
  backend:
    volumes:
      - raddb-server1:/mnt/raddb/server-1:rw
      - raddb-server2:/mnt/raddb/server-2:rw
      - raddb-server3:/mnt/raddb/server-3:rw
      - /var/run/docker.sock:/var/run/docker.sock:ro

  freeradius-1:
    volumes:
      - raddb-server1:/etc/raddb:rw

volumes:
  raddb-server1:
  raddb-server2:
  raddb-server3:
```

**Security mandatory:** Path traversal prevention on every file operation. All paths must resolve within the designated raddb mount point.

```python
class ConfigManager:
    RADDB_BASE = "/mnt/raddb"

    def write_config(self, server_id: str, path: str, content: str):
        full_path = Path(self.RADDB_BASE) / server_id / path
        resolved = full_path.resolve()
        if not str(resolved).startswith(str(Path(self.RADDB_BASE).resolve())):
            raise SecurityError("Path traversal attempt detected")
        # Backup before writing
        shutil.copy2(full_path, full_path.with_suffix(full_path.suffix + '.bak'))
        full_path.write_text(content)
```

### Pattern 5: SSE for Real-Time Dashboard Updates

**What:** Server-Sent Events for pushing live data to the dashboard.

**When:** Active sessions, auth stats, server health.

**Why:** SSE is simpler than WebSocket for one-way server-to-client streaming. Auto-reconnects natively. Sufficient for dashboard use case. FastAPI has native SSE support via `EventSourceResponse`.

```python
from fastapi.responses import StreamingResponse

@router.get("/servers/{server_id}/events")
async def event_stream(
    server_id: int,
    server: ServerRecord = Depends(get_server),
    current_user: AppUser = Depends(get_current_user),
):
    async def generate():
        while True:
            # Query active sessions from radacct
            sessions = await get_active_sessions(server_id)
            stats = await get_auth_stats(server_id)
            yield f"event: sessions\ndata: {json.dumps(sessions)}\n\n"
            yield f"event: stats\ndata: {json.dumps(stats)}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Alternative for higher efficiency:** PostgreSQL LISTEN/NOTIFY. Create a trigger on radacct/radpostauth that fires NOTIFY, and the backend listens for notifications instead of polling. This eliminates the 5-second polling delay.

```sql
-- Trigger on radacct for real-time session notifications
CREATE OR REPLACE FUNCTION notify_session_change() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('radius_session_change', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER radacct_notify AFTER INSERT OR UPDATE ON radius.radacct
    FOR EACH ROW EXECUTE FUNCTION notify_session_change();
```

### Pattern 6: RBAC via FastAPI Dependencies

**What:** Role-based access control enforced through FastAPI's dependency injection.

**When:** Every API request.

```python
class Role(IntEnum):
    VIEWER = 0
    OPERATOR = 1
    ADMIN = 2
    SUPER_ADMIN = 3

def require_role(minimum_role: Role):
    async def check_role(current_user = Depends(get_current_user)):
        if current_user.role < minimum_role:
            raise HTTPException(status_code=403, detail=f"Role {minimum_role.name} required")
        return current_user
    return check_role
```

**RBAC Matrix:**

| Resource | Viewer | Operator | Admin | Super Admin |
|----------|--------|----------|-------|-------------|
| Dashboard | Read | Read | Read | Read |
| RADIUS Users | Read | CRUD | CRUD | CRUD |
| RADIUS Groups | Read | CRUD | CRUD | CRUD |
| NAS Devices | Read | Read | CRUD | CRUD |
| Sessions | Read | Read | Read | Read |
| Auth/Acct Logs | Read | Read | Read+Export | Read+Export |
| Server Status | Read | Read | Read | Read+Control |
| Server Config | - | - | Read | Read+Write |
| App Users/Roles | - | - | Read | CRUD |
| Restart/Reload | - | - | - | Execute |

---

## Data Flow

### Flow 1: RADIUS User Creation (SQL-based, no restart needed)

```
Admin clicks "Create User"
        |
        v
[Next.js] POST /api/v1/servers/{id}/users {username, password, group, attributes}
        |
        v
[FastAPI] Validate JWT -> Check RBAC (Operator+) -> Validate input (Pydantic)
        |
        v
[RadiusUserService] Transaction:
  1. INSERT INTO radius.radcheck (UserName, Attribute, op, Value)
     VALUES ('jdoe', 'Cleartext-Password', ':=', 'secret')
  2. INSERT INTO radius.radreply (UserName, Attribute, op, Value)
     VALUES ('jdoe', 'Framed-IP-Address', '=', '10.0.1.50')
  3. INSERT INTO radius.radusergroup (UserName, GroupName, priority)
     VALUES ('jdoe', 'employees', 0)
        |
        v
[AuditService] INSERT INTO app.audit_log (actor, action, target, details, timestamp)
        |
        v
[FastAPI] Return 201 Created
        |
        v
[Next.js] Router refresh -> Server Component re-fetches user list
```

**No SIGHUP needed.** FreeRADIUS reads SQL tables on every authentication request.

### Flow 2: Config File Change (e.g., EAP Module -- requires restart)

```
Admin edits EAP config for Server 1
        |
        v
[Next.js] PUT /api/v1/servers/server-1/config/mods-available/eap {content}
        |
        v
[FastAPI] Validate JWT -> Check RBAC (Super Admin only)
        |
        v
[ConfigManager]
  1. Validate path (no traversal)
  2. Backup: /mnt/raddb/server-1/mods-available/eap -> eap.bak
  3. Write new content to /mnt/raddb/server-1/mods-available/eap
  4. Detect: "mods-available/eap" -> requires RESTART
        |
        v
[Response] 200 OK {reload_required: "restart", message: "EAP changes require full restart"}
        |
        v
[Next.js] Shows "Restart Required" banner
        |
        v
Admin clicks "Restart Server"
        |
        v
[FastAPI] POST /api/v1/servers/server-1/restart
        |
        v
[DockerManager] container.restart(timeout=10)
        |
        v
[AuditService] Log: "Super Admin restarted server-1"
```

### Flow 3: Live Session Monitoring (SSE)

```
Admin opens "Active Sessions" page
        |
        v
[Next.js Client Component] Opens SSE: /api/v1/servers/{id}/events
        |
        v
[FastAPI SSE endpoint]
  1. Validate JWT
  2. Start SSE stream
        |
        v
[Background loop every 5s]
  SELECT * FROM radius.radacct WHERE AcctStopTime IS NULL
        |
        v
  yield event: sessions
  data: [{username, nasipaddress, acctsessiontime, ...}]
        |
        v
[Next.js Client Component] Receives SSE -> Updates session table in real-time
```

### Flow 4: RADIUS Authentication (FreeRADIUS side -- not UI)

```
WiFi client connects to access point
        |
        v
[NAS Device] RADIUS Access-Request (UDP 1812) -> FreeRADIUS instance
        |
        v
[FreeRADIUS rlm_sql]
  1. authorize: SELECT * FROM radius.radcheck WHERE UserName = 'jdoe'
  2. authenticate: Compare password with stored attribute
  3. post-auth: INSERT INTO radius.radpostauth (username, pass, reply, authdate)
        |
        v
[FreeRADIUS] Access-Accept or Access-Reject -> NAS
        |
        v
[NAS] Accounting-Start (UDP 1813) -> FreeRADIUS
        |
        v
[FreeRADIUS rlm_sql] INSERT INTO radius.radacct (...)
        |
        v
(This accounting data is what the UI reads for live sessions and reports)
```

---

## Scaling Considerations

| Concern | 1-3 Servers (v1) | 10-50 Servers | 100+ Servers |
|---------|-------------------|---------------|--------------|
| **Server Management** | Docker labels + socket on single host | Server registry in DB, Docker API over TCP/TLS per host | Agent-based: lightweight agent per host, central API |
| **Config Management** | Shared volumes on single host | Git-based config + deploy pipeline | Config management tool (Ansible) with API |
| **Database** | Single PostgreSQL instance | Read replicas for reporting | Shard radacct by time, separate reporting DB |
| **Real-time Updates** | SSE from single backend | Redis Pub/Sub for cross-instance fan-out | Message broker (NATS/Redis Streams) + SSE gateway |
| **Session Monitoring** | Poll radacct every 5s | PostgreSQL LISTEN/NOTIFY | Dedicated accounting aggregation service |
| **Deployment** | Single docker-compose | Docker Swarm or K8s | Kubernetes with Helm charts |

**v1 targets 1-3 servers.** Do not over-engineer. But preserve scalability with:
1. Service layer abstraction (swap Docker socket for remote API later)
2. Server registry in database (not hardcoded)
3. Config management as a service (swap volume mounts for Git-based later)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Frontend Direct Database Access

**What:** Next.js Server Actions or API routes that query PostgreSQL directly, bypassing FastAPI.

**Why bad:** Splits business logic between two codebases. RBAC enforcement becomes inconsistent. Makes the frontend dependent on database schema details. Two connection pools competing for the same database.

**Instead:** All data flows through FastAPI. Next.js is a pure API consumer.

### Anti-Pattern 2: Single Schema with Mixed Migrations

**What:** Putting FreeRADIUS tables and application tables in the same `public` schema, managing all tables with Alembic.

**Why bad:** Alembic autogenerate may try to modify FreeRADIUS tables. FreeRADIUS PascalCase column names (UserName, AcctSessionTime) clash with Python conventions. Risk of accidentally altering a table FreeRADIUS depends on.

**Instead:** Two schemas. FreeRADIUS tables from official `schema.sql`. Application tables managed by Alembic targeting only `app` schema.

### Anti-Pattern 3: SSH into FreeRADIUS Containers

**What:** Using SSH or `docker exec` from the backend to run commands inside containers.

**Why bad:** Requires SSH server in RADIUS containers (attack surface). Complex credential management. Fragile command parsing. `docker exec` requires privileged access.

**Instead:** Docker API for signals. Shared volumes for file access. PostgreSQL for data. No need to execute commands inside the container.

### Anti-Pattern 4: Polling REST Endpoints for Dashboard Updates

**What:** Frontend polling `GET /api/stats` every 2 seconds.

**Why bad:** N users x 30 requests/minute = high load. Wastes bandwidth when nothing changes.

**Instead:** SSE connection. One persistent connection per client. Server pushes updates only when data changes or at reasonable intervals (5-10s).

### Anti-Pattern 5: Direct Docker Socket Exposure

**What:** Creating API endpoints that proxy raw Docker commands.

**Why bad:** If the backend is compromised, unrestricted Docker socket access = full host compromise.

**Instead:** Specific, limited endpoints: `POST /servers/{id}/reload`, `POST /servers/{id}/restart`, `GET /servers/{id}/health`. Backend validates permissions and only executes whitelisted operations. Consider a Docker socket proxy (e.g., Tecnativa/docker-socket-proxy) to limit API surface.

### Anti-Pattern 6: Unbounded Aggregate Queries

**What:** Running COUNT/SUM/AVG on radacct and radpostauth on every dashboard page load.

**Why bad:** These tables grow unboundedly. Aggregate queries become slow. Blocks the database for FreeRADIUS operations.

**Instead:** Pre-compute stats. Store in `app.dashboard_metrics` table. Refresh periodically (every minute for live stats, hourly for historical). Use materialized views for complex aggregations.

### Anti-Pattern 7: Storing JWT in localStorage

**What:** Persisting access tokens in browser localStorage.

**Why bad:** XSS vulnerability. Any injected script can steal the token.

**Instead:** Access token in memory (React state). Refresh token in httpOnly secure cookie. Short-lived access tokens (30 min), refresh silently.

---

## Integration Points Summary

| Integration | Protocol | Library/Method | Security |
|-------------|----------|----------------|----------|
| Frontend -> Backend (REST) | HTTP/JSON | fetch with Bearer JWT | JWT validation, RBAC |
| Frontend -> Backend (SSE) | HTTP/SSE | EventSource with JWT query param | JWT validation |
| Backend -> PostgreSQL | PostgreSQL wire | SQLAlchemy async (asyncpg) | Dedicated DB user per schema |
| Backend -> Docker | Unix socket | docker-py | Socket proxy recommended |
| Backend -> Config files | Filesystem | pathlib (Python) | Path traversal prevention |
| FreeRADIUS -> PostgreSQL | PostgreSQL wire | rlm_sql_postgresql | Dedicated radius DB user |
| FreeRADIUS -> NAS | RADIUS (UDP 1812/1813) | Native | Shared secrets per NAS |

**Connection pool management:** Total connections across all FreeRADIUS instances + backend must not exceed PostgreSQL `max_connections`. Plan for: 3 FR instances x 5 connections + backend pool of 20 = 35 connections minimum. Set `max_connections = 100` to be safe.

---

## Build Order (Dependency Graph)

The architecture dictates this build order based on component dependencies:

```
Phase 1: Database + Schema
    |
    v
Phase 2: Backend Core (auth, DB access, RBAC)
    |
    +---> Phase 3: RADIUS CRUD API
    |         |
    |         v
    |     Phase 4: FreeRADIUS Containers (validate SQL mode)
    |
    +---> Phase 5: Frontend Shell (login, layout, auth flow)
              |
              v
          Phase 6: Frontend CRUD Pages
              |
              v
          Phase 7: Server Management (Docker integration)
              |
              v
          Phase 8: Real-Time Features (SSE, live sessions)
              |
              v
          Phase 9: Config Editor UI
              |
              v
          Phase 10: Dashboard + Reporting
```

| Phase | What | Depends On | Validates |
|-------|------|------------|-----------|
| 1. Database + Schema | PostgreSQL with dual schema, init scripts | Nothing | Schema separation works |
| 2. Backend Core | FastAPI skeleton, auth, RBAC, DB connection | Database | JWT flow, RBAC enforcement |
| 3. RADIUS CRUD API | User/Group/NAS endpoints + service layer | Backend Core | Operator semantics correct |
| 4. FreeRADIUS in Docker | FR containers with SQL module, test auth | Database + CRUD API | End-to-end: create user via API -> auth via RADIUS |
| 5. Frontend Shell | Next.js app, login, layouts, API client | Backend Core | Auth flow end-to-end |
| 6. Frontend CRUD | User/Group/NAS management pages | CRUD API + Shell | Full CRUD workflow in browser |
| 7. Server Management | Docker service, status, reload/restart | Backend Core + FR | Container control works |
| 8. Real-Time | SSE for live sessions and stats | CRUD + Shell + FR | Live data appears in browser |
| 9. Config Editor | File read/write, structured forms | Server Management + Shell | Config change -> reload -> verified |
| 10. Dashboard | Aggregated stats, charts, reporting | Everything above | Meaningful data visualization |

---

## Sources

- [FreeRADIUS PostgreSQL Schema (v3.2.x)](https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-config/sql/main/postgresql/schema.sql) -- Official schema definition
- [FreeRADIUS SQL Module](https://wiki.freeradius.org/modules/Rlm_sql) -- SQL module configuration and table usage
- [FreeRADIUS SQL HOWTO](https://wiki.freeradius.org/guide/SQL-HOWTO) -- Setup guide for SQL mode
- [FreeRADIUS raddb Directory](https://networkradius.com/doc/current/raddb/home.html) -- Configuration file structure
- [FreeRADIUS SIGHUP Behavior](https://lists.freeradius.org/pipermail/freeradius-users/2018-March/091126.html) -- What gets reloaded on HUP vs. what requires restart
- [Docker SDK for Python](https://docker-py.readthedocs.io/en/stable/containers.html) -- Container management API
- [Docker Signal Handling](https://blog.confirm.ch/sending-signals-docker-container/) -- Sending signals to containers
- [daloRADIUS Architecture](https://deepwiki.com/lirantal/daloradius/1-overview) -- Reference: shared database pattern with app extension tables
- [OpenWISP RADIUS](https://github.com/openwisp/openwisp-radius) -- Reference: Django-based FreeRADIUS management with REST API
- [SQLAlchemy PostgreSQL Multi-Schema](https://docs.sqlalchemy.org/en/21/dialects/postgresql.html) -- Schema qualification best practices
- [PostgreSQL Multi-Schema Best Practices](https://dev.to/haraf/best-practices-for-handling-multiple-schemas-in-the-same-database-across-applications-with-1bkp) -- Schema isolation patterns
- [Next.js 15 App Router Structure](https://nextjs.org/docs/app/getting-started/project-structure) -- Official project structure guide
- [FastAPI RBAC Patterns](https://deepwiki.com/fastapi-practices/fastapi_best_architecture/3.2-rbac-system) -- Dependency injection RBAC
- [FastAPI Real-Time Dashboard Patterns](https://testdriven.io/blog/fastapi-postgres-websockets/) -- WebSocket/SSE with PostgreSQL
