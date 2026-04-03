# Technology Stack

**Project:** Radius UI -- FreeRADIUS Management Web Application
**Researched:** 2026-04-03
**Overall Confidence:** HIGH

---

## Recommended Stack

### Frontend Core

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 15.5.x (LTS) | React framework, SSR, routing | Project specifies Next.js 15. Still in Active LTS. v16 is available but migration is unnecessary -- 15.5.x is stable and fully supported. Stick with 15 to avoid breaking changes (async request APIs fully removed in v16). | HIGH |
| React | 19.x | UI rendering | Ships with Next.js 15.5. React 19 brings Server Components, Actions, use() hook. | HIGH |
| TypeScript | 5.7+ | Type safety | Bundled with Next.js 15. Strict mode mandatory per project conventions. | HIGH |
| Tailwind CSS | 4.x | Utility-first CSS | v4 is current stable (Jan 2025). CSS-first config with @theme directive, 5x faster builds via Rust engine, no tailwind.config.ts needed. shadcn/ui has full Tailwind v4 support. | HIGH |
| shadcn/ui | CLI v4 (March 2026) | Component library | Not a package -- copy-paste components via CLI. Supports Tailwind v4 + React 19 natively. OKLCH colors. Radix UI primitives for accessibility. | HIGH |

### Frontend Supporting Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| Recharts | 3.8.x | Charts and dashboards | Project-specified. Built on React + D3, declarative API, 24K+ GitHub stars. v3 has better performance and animations than v2. | HIGH |
| TanStack Query | 5.96.x | Server state / data fetching | De facto standard for API data fetching in React. Caching, background updates, optimistic mutations, stale-while-revalidate. 12M weekly npm downloads. | HIGH |
| Zustand | 5.x | Client state management | Lightweight (~3KB), no Provider needed, simple hook-based API. Ideal for UI state (sidebar toggle, modals, selected server). Use TanStack Query for server state, Zustand only for pure client state. | HIGH |
| React Hook Form | 7.x | Form handling | Best-in-class form library. Minimal re-renders via uncontrolled components. Native shadcn/ui integration. v8 is beta -- stay on v7 stable. | HIGH |
| Zod | 4.3.x | Schema validation | Runtime validation with TypeScript type inference. Used by shadcn/ui forms, @hookform/resolvers, and can share schemas with backend Pydantic models conceptually. v4 is faster and slimmer than v3. | HIGH |
| @hookform/resolvers | 5.2.x | RHF + Zod bridge | Connects React Hook Form to Zod schemas via zodResolver. | HIGH |
| lucide-react | 1.7.x | Icons | Default icon set for shadcn/ui. Tree-shakable, TypeScript-typed, consistent design. | HIGH |
| next-intl | latest | Internationalization | Deferred to v2 per project spec, but install the infrastructure early. Best Next.js i18n library, ~2KB, native Server Component support. | MEDIUM |
| nuqs | latest | URL search params state | Type-safe URL state management for filters, pagination, search. Useful for admin tables. | MEDIUM |

### Backend Core

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Python | 3.12.x | Runtime | Stable, performant, wide library support. 3.13 is available but 3.12 has better ecosystem compatibility. FastAPI 0.135.x requires 3.10+. | HIGH |
| FastAPI | 0.135.x | API framework | Project-specified. Auto-generated OpenAPI docs, async-native, dependency injection, built-in SSE support (added in 0.135.0). | HIGH |
| Pydantic | 2.12.x (stable) | Data validation / serialization | Core of FastAPI. v2 is 50x faster than v1. Required for request/response models. | HIGH |
| SQLAlchemy | 2.0.48 | ORM / database toolkit | Project-specified. Full async support, modern 2.0-style queries, type annotations. | HIGH |
| Alembic | 1.18.x | Database migrations | Only serious migration tool for SQLAlchemy. Autogeneration, offline mode, branching. Must coexist with FreeRADIUS schema (see Pitfalls). | HIGH |
| Uvicorn | 0.41.x | ASGI server | Standard FastAPI server. Install with uvicorn[standard] for uvloop + httptools performance. | HIGH |

### Backend Supporting Libraries

| Library | Version | Purpose | Why | Confidence |
|---------|---------|---------|-----|------------|
| asyncpg | 0.30.x | PostgreSQL async driver | 5x faster than psycopg3 for async workloads. Native asyncio, binary protocol. Used via SQLAlchemy's postgresql+asyncpg dialect. | HIGH |
| PyJWT | 2.x | JWT token handling | Official FastAPI recommendation (replaced python-jose which is abandoned). Lightweight, actively maintained. | HIGH |
| pwdlib[argon2] | latest | Password hashing | Modern replacement for passlib (unmaintained, deprecated crypt module in Python 3.13). Argon2 is memory-hard, GPU-resistant. Backwards-compatible with bcrypt for migration. | HIGH |
| docker | 7.1.x | Docker Engine API | Manage FreeRADIUS containers: send HUP signals, restart, check health, read logs. Access via Docker socket mount. | HIGH |
| pyrad | 2.5.x | RADIUS protocol client | Send RADIUS test packets (Access-Request, Accounting-Request) to FreeRADIUS for health checks and connectivity testing. Mature, RFC2865 compliant. | MEDIUM |
| httpx | 0.28.x | Async HTTP client | For inter-service communication and testing. Async-native, used in FastAPI test client. | HIGH |
| python-multipart | latest | Form data parsing | Required by FastAPI for file uploads (certificate uploads, config file imports). | HIGH |
| APScheduler | 3.x | Background task scheduling | Periodic tasks: session cleanup, stats aggregation, health checks. Lightweight alternative to Celery for admin UI workloads. | MEDIUM |

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 16.x | Primary database | Project-specified. Shared with FreeRADIUS (radcheck, radreply, radacct, etc.). LISTEN/NOTIFY for real-time updates. | HIGH |
| Redis | 7.x | Caching + token blacklist | JWT token revocation list, session caching, rate limiting. Optional but strongly recommended for production. | MEDIUM |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Docker Compose | 2.x | Container orchestration | Project-specified. 6 services: frontend, backend, postgres, 3x freeradius. | HIGH |
| FreeRADIUS | 3.2.x | RADIUS server | Project-specified. Use freeradius/freeradius-server Docker image. SQL mode with PostgreSQL backend. | HIGH |
| Nginx | alpine | Reverse proxy | Frontend serving + API proxying in production. Optional for dev (Next.js dev server handles it). | MEDIUM |

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | 4.1.x | Frontend unit/integration tests | Default for modern JS/TS in 2026. Faster than Jest, native ESM, Browser Mode stable. Next.js official docs recommend it. | HIGH |
| @testing-library/react | latest | React component testing | Standard companion to Vitest for DOM testing. User-centric queries (getByRole, getByText). | HIGH |
| Playwright | 1.57.x | E2E testing | Cross-browser (Chromium, Firefox, WebKit). Auto-waiting, parallel execution, trace viewer. Project has Playwright plugin. | HIGH |
| pytest | 8.x | Backend unit/integration tests | Python testing standard. Rich plugin ecosystem. | HIGH |
| pytest-asyncio | latest | Async test support | Required for testing async FastAPI endpoints. | HIGH |
| httpx | 0.28.x | FastAPI test client | AsyncClient for testing async endpoints. Replaces TestClient for async tests. | HIGH |
| coverage / pytest-cov | latest | Code coverage | Track test coverage for backend. | MEDIUM |

### Dev Tools

| Tool | Version | Purpose | Why | Confidence |
|------|---------|---------|-----|------------|
| Ruff | latest | Python linter + formatter | Replaces flake8, black, isort in one tool. 10-100x faster (Rust). Industry standard in 2026. | HIGH |
| ESLint | 9.x | JS/TS linting | Next.js ships with it. Flat config format in v9. | HIGH |
| Prettier | 3.x | Frontend formatting | Auto-format via project hooks (auto-format.sh). | HIGH |
| mypy | latest | Python type checking | Static type analysis for Python backend. Catches bugs before runtime. | MEDIUM |
| pre-commit | latest | Git hooks | Run linters and formatters before commits. | MEDIUM |

---

## Version Compatibility Matrix

| Component | Requires | Compatible With |
|-----------|----------|-----------------|
| Next.js 15.5.x | React 19, Node 18.17+ | Tailwind CSS 4.x, shadcn/ui CLI v4 |
| FastAPI 0.135.x | Python 3.10+, Pydantic 2.x | SQLAlchemy 2.0.x, Uvicorn 0.41.x |
| SQLAlchemy 2.0.48 | Python 3.7+ | asyncpg 0.30.x, Alembic 1.18.x |
| Tailwind CSS 4.x | Node 18+ | shadcn/ui CLI v4, Next.js 15+ |
| shadcn/ui CLI v4 | React 19, Tailwind 4.x | Radix UI primitives, lucide-react |
| Recharts 3.8.x | React 18+ | React 19 (compatible) |
| PostgreSQL 16 | -- | FreeRADIUS 3.2.x SQL module, asyncpg |

---

## Installation Commands

### Frontend

```bash
# Initialize Next.js 15 project with TypeScript and Tailwind CSS v4
npx create-next-app@15 radius-ui-frontend --typescript --tailwind --eslint --app --src-dir

# shadcn/ui initialization (interactive, selects Tailwind v4)
npx shadcn@latest init

# Core dependencies
npm install @tanstack/react-query recharts zustand react-hook-form @hookform/resolvers zod lucide-react

# Dev dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @playwright/test jsdom
```

### Backend

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Core
pip install "fastapi[standard]>=0.135.0" "sqlalchemy[asyncio]>=2.0.48" alembic asyncpg
pip install pydantic pyjwt "pwdlib[argon2]" python-multipart docker pyrad httpx

# Dev
pip install pytest pytest-asyncio pytest-cov ruff mypy pre-commit
pip install "uvicorn[standard]>=0.41.0"
```

### Docker Images

```yaml
# docker-compose.yml image references
services:
  postgres:
    image: postgres:16-alpine
  freeradius:
    image: freeradius/freeradius-server:latest  # 3.2.x branch
  frontend:
    build: ./frontend  # Node 20-alpine base
  backend:
    build: ./backend   # Python 3.12-slim base
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Frontend Framework | Next.js 15 | Next.js 16 | v16 removes sync request API compatibility. Project specifies v15. No compelling reason to upgrade for admin UI. |
| React State | Zustand | Redux Toolkit | Overkill for admin UI. Zustand is simpler, smaller, no boilerplate. |
| React State | Zustand | Jotai | Jotai's atomic model adds complexity without benefit here. Zustand's centralized stores map better to "per-server" state. |
| Data Fetching | TanStack Query | SWR | TanStack Query has richer features (mutations, optimistic updates, infinite queries). Better for complex admin dashboards. |
| Charts | Recharts | Victory / Nivo | Project specifies Recharts. Recharts v3 is performant and has the simplest declarative API. |
| Postgres Driver | asyncpg | psycopg3 | asyncpg is 5x faster for async. psycopg3 is more Pythonic but performance matters for real-time dashboards. |
| JWT Library | PyJWT | python-jose | python-jose is abandoned (no release in 3+ years). PyJWT is the official FastAPI recommendation now. |
| JWT Library | PyJWT | authlib/joserfc | Authlib is heavier, designed for OAuth2 server scenarios. PyJWT is sufficient for our JWT-only needs. |
| Password Hashing | pwdlib[argon2] | passlib[bcrypt] | passlib is unmaintained. crypt module deprecated in Python 3.13. pwdlib is the modern replacement, recommended by FastAPI. |
| Real-time | SSE (built-in FastAPI) | WebSocket | SSE is simpler for server-to-client streaming (dashboard updates). WebSocket is overkill unless bidirectional communication is needed. FastAPI 0.135+ has native EventSourceResponse with Pydantic serialization. |
| Real-time | FastAPI native SSE | sse-starlette | sse-starlette (v3.3.4) is mature but FastAPI 0.135.0+ ships built-in SSE support. One fewer dependency. |
| ASGI Server | Uvicorn | Hypercorn / Daphne | Uvicorn is the FastAPI default, best documented, most performant with uvloop. |
| Python Linter | Ruff | flake8 + black + isort | Ruff replaces all three in a single Rust-powered tool. 10-100x faster. No reason to use the old stack. |
| Testing (FE) | Vitest | Jest | Vitest is faster, native ESM, recommended by Next.js docs in 2026. Jest requires more config. |
| Testing (E2E) | Playwright | Cypress | Playwright supports multiple browsers, has better async handling, lighter CI footprint. |
| Task Queue | APScheduler | Celery | Celery requires a message broker (RabbitMQ/Redis). Overkill for periodic admin tasks. APScheduler runs in-process. |
| i18n | next-intl | react-i18next | next-intl is purpose-built for Next.js App Router. Smaller bundle, Server Component support. |

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| python-jose | Abandoned. Last release 3+ years ago. FastAPI docs migrated away from it. |
| passlib | Unmaintained. Uses deprecated crypt module removed in Python 3.13. |
| TestClient (sync) from FastAPI | Blocks the event loop. Use httpx.AsyncClient for async endpoint testing. |
| psycopg2 | Legacy sync driver. Use asyncpg for async, or psycopg3 if you need sync fallback. |
| Redux / Redux Toolkit | Over-engineered for an admin UI. 10x more boilerplate than Zustand for the same result. |
| Celery | Requires dedicated broker infrastructure. Unnecessary for admin dashboard background tasks. |
| tailwind.config.js | Tailwind v4 uses CSS-first config (@theme directive). JS config is deprecated. |
| daloRADIUS | PHP legacy tool. Referenced as competitor -- do not borrow patterns from its architecture. |
| FreeRADIUS v4.x | Still alpha. Project explicitly targets v3.2.x only. |
| Moment.js | Deprecated. Use native Intl or date-fns if date formatting is needed. |

---

## Environment Variables Structure

```bash
# .env.example (never commit .env itself)

# Database
DATABASE_URL=postgresql+asyncpg://radius:password@postgres:5432/radius
DATABASE_URL_SYNC=postgresql://radius:password@postgres:5432/radius  # For Alembic

# Auth
JWT_SECRET_KEY=change-me-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Docker
DOCKER_SOCKET=/var/run/docker.sock

# FreeRADIUS instances (comma-separated or JSON config)
FREERADIUS_INSTANCES=freeradius-1:1812,freeradius-2:1812,freeradius-3:1812
RADIUS_SHARED_SECRET=testing123

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Sources

### Official Documentation
- [Next.js 15 docs](https://nextjs.org/docs/app/guides/upgrading/version-15) -- v15.5.9 latest patch
- [FastAPI docs](https://fastapi.tiangolo.com/) -- v0.135.3, PyJWT recommendation, native SSE
- [SQLAlchemy 2.0 async docs](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) -- v2.0.48
- [Alembic docs](https://alembic.sqlalchemy.org/) -- v1.18.4
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- CSS-first configuration
- [shadcn/ui Tailwind v4 support](https://ui.shadcn.com/docs/tailwind-v4) -- CLI v4 (March 2026)
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- v3.8.1
- [Uvicorn docs](https://www.uvicorn.org/) -- v0.41.0
- [Docker SDK for Python](https://docker-py.readthedocs.io/) -- v7.1.0
- [pyrad documentation](https://pyradius-pyrad.readthedocs.io/) -- v2.5.4
- [FreeRADIUS PostgreSQL schema](https://github.com/FreeRADIUS/freeradius-server/blob/v3.2.x/raddb/mods-config/sql/main/postgresql/schema.sql)

### Package Registries
- [FastAPI on PyPI](https://pypi.org/project/fastapi/) -- v0.135.3
- [Pydantic on PyPI](https://pypi.org/project/pydantic/) -- v2.12.5 stable
- [Zod on npm](https://www.npmjs.com/package/zod) -- v4.3.6
- [TanStack Query on npm](https://www.npmjs.com/package/@tanstack/react-query) -- v5.96.1
- [Vitest on npm](https://www.npmjs.com/package/vitest) -- v4.1.2

### Community / Analysis
- [FastAPI JWT discussion: python-jose abandoned](https://github.com/fastapi/fastapi/discussions/11345)
- [FastAPI pwdlib migration PR](https://github.com/fastapi/fastapi/pull/13917)
- [asyncpg vs psycopg3 comparison](https://fernandoarteaga.dev/blog/psycopg-vs-asyncpg/)
- [Zustand vs Jotai 2026 comparison](https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge)
