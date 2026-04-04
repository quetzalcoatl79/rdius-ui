---
phase: 01-foundation
plan: "03"
subsystem: ui
tags: [nextjs, react, typescript, tailwindcss, shadcn-ui, jwt, auth, middleware]

# Dependency graph
requires:
  - phase: 01-foundation/01-02
    provides: FastAPI auth endpoints (login, refresh, logout, me) with httpOnly cookie
provides:
  - Next.js 15 frontend app with App Router, Tailwind CSS 4, shadcn/ui
  - Login page at /login with email/password form
  - AuthProvider context managing access token (memory) + refresh via httpOnly cookie
  - Middleware protecting routes by checking refresh_token cookie
  - Dashboard shell with sidebar navigation, header bar, and placeholder stat cards
affects:
  - Phase 2 UI work (all feature pages will use the dashboard layout)
  - Any plan that adds routes protected by middleware
  - Future auth-dependent components (useAuth hook available)

# Tech tracking
tech-stack:
  added:
    - Next.js 15.5.14 (App Router, TypeScript, Tailwind CSS 4)
    - shadcn/ui CLI v4 (button, input, card, label components)
    - TanStack Query v5 (QueryClientProvider in Providers wrapper)
    - lucide-react v1.7 (icons for sidebar navigation)
  patterns:
    - Auth context pattern: access token in module-level variable (not localStorage), refresh via cookie
    - Route group pattern: (auth) for login layout, (dashboard) for sidebar+header layout
    - Providers wrapper pattern: client-side providers isolated in providers.tsx
    - API fetch pattern: apiFetch() with auto-refresh on 401

key-files:
  created:
    - frontend/src/lib/api.ts
    - frontend/src/lib/auth.tsx
    - frontend/src/middleware.ts
    - frontend/src/app/providers.tsx
    - frontend/src/app/(auth)/layout.tsx
    - frontend/src/app/(auth)/login/page.tsx
    - frontend/src/app/(dashboard)/layout.tsx
    - frontend/src/app/(dashboard)/page.tsx
    - frontend/src/components/layout/sidebar.tsx
    - frontend/src/components/layout/header.tsx
    - frontend/Dockerfile
  modified:
    - frontend/next.config.ts
    - frontend/src/app/layout.tsx
    - frontend/src/app/page.tsx

key-decisions:
  - "auth.ts renamed to auth.tsx because JSX in .ts files causes webpack syntax error in Next.js"
  - "access token stored in module-level variable (not localStorage) for XSS protection"
  - "route group (dashboard)/page.tsx re-exported via app/page.tsx to resolve conflict without deletion"
  - "Next.js downgraded from 16 to 15.5.x per project stack spec (v16 breaks async request APIs)"

patterns-established:
  - "apiFetch(): always pass credentials: include so cookies are sent with every request"
  - "AuthProvider wraps entire app via Providers wrapper — all client components can call useAuth()"
  - "Middleware checks refresh_token cookie (httpOnly) — not access token — for route protection"
  - "French UI labels: Bienvenue, Utilisateurs, Déconnexion, Connexion etc."

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03

# Metrics
duration: 383min
completed: 2026-04-03
---

# Phase 01 Plan 03: Next.js Frontend with Auth and Dashboard Shell Summary

**Next.js 15 frontend with JWT auth context (memory+cookie), route-protecting middleware, French login page, and dashboard shell with sidebar navigation using shadcn/ui**

## Performance

- **Duration:** ~38 min (agent execution)
- **Started:** 2026-04-03T17:36:40Z
- **Completed:** 2026-04-03T23:59:53Z
- **Tasks:** 3 of 3
- **Files modified:** 13 created, 3 modified

## Accomplishments

- Next.js 15.5.14 project initialized with Tailwind CSS 4 (CSS-first), shadcn/ui CLI v4 components (button, input, card, label), and TanStack Query v5
- Auth system: `api.ts` (fetch client with Bearer injection + auto-refresh on 401), `auth.tsx` (AuthProvider context with login/logout), `middleware.ts` (refresh_token cookie guard redirecting to /login)
- Dashboard shell: sidebar with 7 nav items + logout, header with role badge, French dashboard page with "Bienvenue sur Radius UI" and placeholder stat cards

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Next.js 15 project with Tailwind CSS 4 and shadcn/ui** - `f8ec38d` (feat)
2. **Task 2: Auth library and login page** - `353bcb4` (feat)
3. **Task 3: Dashboard shell layout** - `32fa78a` (feat)

## Files Created/Modified

- `frontend/src/lib/api.ts` - Fetch client with Bearer token injection and auto-refresh on 401
- `frontend/src/lib/auth.tsx` - AuthProvider context with login/logout/fetchUser, useAuth hook
- `frontend/src/middleware.ts` - Route protection via refresh_token cookie check
- `frontend/src/app/providers.tsx` - Client providers wrapper (QueryClientProvider + AuthProvider)
- `frontend/src/app/(auth)/login/page.tsx` - Login form with email/password, error display, French labels
- `frontend/src/app/(auth)/layout.tsx` - Centered layout for auth pages
- `frontend/src/app/(dashboard)/layout.tsx` - Two-column layout with Sidebar + Header
- `frontend/src/app/(dashboard)/page.tsx` - Dashboard home with Bienvenue, user info, stat cards
- `frontend/src/components/layout/sidebar.tsx` - Fixed sidebar with navigation items and logout
- `frontend/src/components/layout/header.tsx` - Top header with role badge and user name
- `frontend/next.config.ts` - standalone output, /api/:path* rewrite to backend:8000
- `frontend/src/app/layout.tsx` - lang=fr, Inter font, Providers wrapper
- `frontend/Dockerfile` - Multi-stage build (node:22-alpine, standalone output)

## Decisions Made

- **auth.tsx extension**: Auth file uses JSX (`<AuthContext.Provider>`) so must be `.tsx` not `.ts` — webpack fails to parse JSX in `.ts` files
- **Access token in memory**: Stored in module-level variable in `api.ts` (not localStorage), XSS-safe — cleared on page reload, restored via /auth/me endpoint using httpOnly refresh cookie
- **Next.js 15 over 16**: `create-next-app@latest` installed v16.2.2; downgraded to ^15.5.x per STACK.md spec (v16 removes sync request API compatibility shims)
- **Route conflict resolution**: `app/page.tsx` re-exports from `(dashboard)/page.tsx` to avoid conflict while keeping dashboard layout applied to sub-pages — `(dashboard)/layout.tsx` applies to all pages physically inside the route group
- **AuthProvider in root layout**: Added immediately in Task 2 (needed for login page build) then upgraded to full `Providers` wrapper in Task 3

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js 16 installed instead of 15**
- **Found during:** Task 1 (initialization)
- **Issue:** `create-next-app@latest` resolved to v16.2.2 despite plan specifying 15.5.x per STACK.md
- **Fix:** Ran `npm install next@^15.5.0` after initialization to downgrade to 15.5.14
- **Files modified:** frontend/package.json, frontend/package-lock.json
- **Verification:** Build output shows `▲ Next.js 15.5.14`
- **Committed in:** f8ec38d (Task 1 commit)

**2. [Rule 1 - Bug] auth.ts renamed to auth.tsx for JSX support**
- **Found during:** Task 2 (build verification)
- **Issue:** `auth.ts` uses JSX syntax (`<AuthContext.Provider>`), webpack throws syntax error on `.ts` file
- **Fix:** Renamed to `auth.tsx` — TypeScript+Next.js supports JSX in .tsx files only
- **Files modified:** frontend/src/lib/auth.tsx (renamed from auth.ts)
- **Verification:** `npm run build` passes with 0 TypeScript errors
- **Committed in:** 353bcb4 (Task 2 commit)

**3. [Rule 3 - Blocking] AuthProvider added to root layout in Task 2**
- **Found during:** Task 2 (build verification)
- **Issue:** Login page calls `useAuth()` which requires `AuthContext` — build pre-renders /login and crashes with "Cannot destructure property 'login' of null"
- **Fix:** Added `AuthProvider` to root `layout.tsx` immediately in Task 2, upgraded to full `Providers` wrapper in Task 3
- **Files modified:** frontend/src/app/layout.tsx
- **Verification:** `npm run build` generates /login route successfully
- **Committed in:** 353bcb4 (Task 2 commit), updated in 32fa78a (Task 3 commit)

**4. [Rule 3 - Blocking] Removed embedded .git from frontend/**
- **Found during:** Task 1 (commit attempt)
- **Issue:** `create-next-app` initializes a git repo inside frontend/, causing it to be treated as a git submodule
- **Fix:** `git rm --cached frontend && rm -rf frontend/.git` to track as regular directory
- **Files modified:** None (git state fix)
- **Verification:** `git add frontend/` works without submodule warnings
- **Committed in:** f8ec38d (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 Rule 1 bug, 3 Rule 3 blocking)
**Impact on plan:** All fixes necessary for compilation and correctness. No scope creep.

## Issues Encountered

- **Windows ENOENT warning in standalone build**: `(dashboard)/page_client-reference-manifest.js` copy fails during `standalone` output generation on Windows — this is a known Next.js 15 Windows path handling issue and does not affect app functionality (`npm run dev` or running the server works correctly)
- **Route conflict app/page.tsx vs (dashboard)/page.tsx**: Both resolve to URL `/`. Solved by having `app/page.tsx` re-export from `(dashboard)/page.tsx` — the `(dashboard)/layout.tsx` applies to all sub-pages (users, groups, nas etc.) while the root page gets the layout via the route group

## User Setup Required

None - no external service configuration required. Backend must be running for auth to work end-to-end (see Plan 02 setup).

## Known Stubs

- `sidebar.tsx` nav items are placeholder links (`/users`, `/groups`, `/nas`, `/logs`, `/servers`, `/settings`) — all return 404 until Phase 2 implements those pages
- Dashboard stat cards all show `0` — will be wired to real API data in Phase 2 (sessions, NAS count etc.)
- These stubs are intentional — dashboard shell is the deliverable for this plan, data wiring is Phase 2

## Next Phase Readiness

- Frontend auth loop is complete: login → token storage → auto-refresh → logout
- Middleware protects all routes by checking httpOnly refresh_token cookie
- Dashboard shell provides the layout frame for all Phase 2 UI pages
- Run `docker compose up` then navigate to http://localhost:3000 → redirected to /login → login with seeded credentials → dashboard renders
- Blocker: `docker-compose.yml` needs the frontend service configured (port 3000 mapping)

---
*Phase: 01-foundation*
*Completed: 2026-04-03*
