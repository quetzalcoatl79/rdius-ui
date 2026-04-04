---
phase: 03-observability
plan: "02"
subsystem: ui
tags: [recharts, react-query, sse, next.js, dashboard, logs, tanstack]

# Dependency graph
requires:
  - phase: 03-01
    provides: Backend dashboard/log API endpoints (metrics, auth-rates, traffic-per-nas, top-users, SSE stream, accounting, sessions, postauth)
  - phase: 02-core-radius-management
    provides: DataTable component, apiFetch/getAccessToken, useQuery pattern, Card/Badge/Button/Input components
provides:
  - Full dashboard page with 4 metric cards, Recharts AreaChart + BarChart, SSE real-time sessions, top users table
  - Three log pages (accounting, active sessions, post-auth) with filtering and server-side pagination
  - useSSE hook with token auth via query param and auto-reconnect
  - dashboard-api.ts and logs-api.ts API clients
  - Shared format.ts utility (formatDuration, formatBytes, formatDate)
  - Sidebar updated with Journaux section (3 sub-items)
affects: [04-config-management, future-phases-using-logs]

# Tech tracking
tech-stack:
  added: [recharts@3.8.1, @types/recharts@1.8.29]
  patterns:
    - useSSE hook pattern with EventSource + token query param (browser EventSource cannot set Authorization headers)
    - Separate activeFilters state to delay query until Rechercher button click (not immediate on input change)
    - Native HTML select for simple status filters (base-ui Select requires multi-component composition pattern)
    - Recharts dark mode via useTheme() + conditional axis/grid colors
    - refetchInterval on useQuery for auto-refresh (10s for sessions, 60s for dashboard)

key-files:
  created:
    - frontend/src/types/dashboard.ts
    - frontend/src/lib/dashboard-api.ts
    - frontend/src/lib/logs-api.ts
    - frontend/src/lib/format.ts
    - frontend/src/hooks/use-sse.ts
    - frontend/src/app/(dashboard)/page.tsx
    - frontend/src/app/(dashboard)/logs/page.tsx
    - frontend/src/app/(dashboard)/logs/sessions/page.tsx
    - frontend/src/app/(dashboard)/logs/postauth/page.tsx
  modified:
    - frontend/src/components/layout/sidebar.tsx
    - frontend/package.json

key-decisions:
  - "Native HTML <select> for status filter: base-ui Select requires Root/Trigger/Content/Item composition, overkill for a simple 3-option status filter"
  - "Separate activeFilters state for accounting and postauth pages: filters only apply on Rechercher click, not on every keystroke"
  - "useSSE enabled=true always on dashboard: SSE connects immediately, SSE data overrides static metrics when connected"
  - "format.ts shared utility extracted: formatDuration/formatBytes were duplicated across Phase 2 pages, extracted to avoid future drift"

patterns-established:
  - "useSSE<T>({ url, enabled }) pattern: EventSource with token query param, auto-reconnect 3s, mountedRef guard"
  - "Active filters pattern: useState for display values + useState for applied values, only update on button click"
  - "Recharts dark mode: useTheme() from next-themes, conditional axisColor/gridColor/tooltipStyle variables"

requirements-completed:
  - DASH-01
  - DASH-02
  - DASH-03
  - DASH-04
  - DASH-05
  - LOG-01
  - LOG-02
  - LOG-03
  - LOG-04
  - LOG-05

# Metrics
duration: 8min
completed: 2026-04-03
---

# Phase 03 Plan 02: Frontend Observability Layer Summary

**Dashboard with 4 metric cards, Recharts charts (AreaChart + BarChart), SSE real-time sessions, and 3 log pages (accounting, active sessions, post-auth) with French UI and server-side pagination**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-03T22:13:25Z
- **Completed:** 2026-04-03T22:21:45Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Dashboard page: 4 metric cards with real-time active sessions via SSE, auth rates AreaChart with time range selector, traffic per NAS BarChart, and top users table with Par trafic/Par temps toggle
- Three log pages: accounting logs with multi-field filters and pagination, active sessions with 10-second auto-refresh, post-auth logs with status/date filters
- Shared infrastructure: useSSE hook, format.ts utilities, dashboard-api.ts + logs-api.ts API clients, sidebar Journaux section

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript types, API clients, SSE hook, and sidebar update** - `4fa9a1a` (feat)
2. **Task 2: Dashboard page with metric cards, Recharts charts, SSE active sessions** - `b1a8eca` (feat)
3. **Task 3: Accounting logs, active sessions, and post-auth log pages** - `b1da28e` (feat)

## Files Created/Modified

- `frontend/src/types/dashboard.ts` - DashboardMetrics, AuthRateBucket, TrafficPerNas, TopUser, AccountingRecord, ActiveSession, PostAuthRecord interfaces
- `frontend/src/lib/dashboard-api.ts` - getDashboardMetrics, getAuthRates, getTrafficPerNas, getTopUsers
- `frontend/src/lib/logs-api.ts` - getAccountingLogs, getActiveSessions, getPostAuthLogs
- `frontend/src/lib/format.ts` - Shared formatDuration, formatBytes, formatDate utilities
- `frontend/src/hooks/use-sse.ts` - useSSE hook with EventSource, token auth, auto-reconnect
- `frontend/src/app/(dashboard)/page.tsx` - Full dashboard with charts (replaced placeholder)
- `frontend/src/app/(dashboard)/logs/page.tsx` - Accounting logs page (9-column DataTable + filters)
- `frontend/src/app/(dashboard)/logs/sessions/page.tsx` - Active sessions with 10s auto-refresh
- `frontend/src/app/(dashboard)/logs/postauth/page.tsx` - Post-auth logs with status filter
- `frontend/src/components/layout/sidebar.tsx` - Added Journaux section with 3 sub-items
- `frontend/package.json` - Added recharts@3.8.1

## Decisions Made

- **Native HTML select for status filter**: base-ui Select requires Root/Trigger/Content/Item/Value composition, which is appropriate for custom dropdowns but overkill for a simple 3-option filter. Native select is simpler, accessible, and styled with Tailwind.
- **Separate activeFilters state**: Filters are applied on Rechercher button click, not immediately on keystroke. This prevents excessive API calls while typing and follows the UX pattern expected for search forms.
- **format.ts shared utility**: formatDuration/formatBytes were already duplicated in Phase 2 session pages. Extracted to a shared utility to prevent drift between dashboard and log pages.
- **useSSE always enabled on dashboard**: SSE connects on mount and stays connected. When SSE data arrives it overrides the static getDashboardMetrics count for the Sessions actives card. Green dot indicator shows SSE connection status.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing recharts dependency**
- **Found during:** Task 2 (Dashboard page)
- **Issue:** Plan specified Recharts charts but recharts was not in package.json; import would fail at build time
- **Fix:** Ran `npm install recharts @types/recharts`
- **Files modified:** frontend/package.json, frontend/package-lock.json
- **Verification:** Build passes, Recharts imports resolve
- **Committed in:** 4fa9a1a (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Recharts Tooltip formatter TypeScript type error**
- **Found during:** Task 2 (Dashboard page build)
- **Issue:** `(value: number) => [string]` is not assignable to Recharts Formatter type — value can be `ValueType | undefined`
- **Fix:** Changed to `(value) => [formatBytes(typeof value === 'number' ? value : 0)]`
- **Files modified:** frontend/src/app/(dashboard)/page.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** b1a8eca (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed pre-existing react/no-unescaped-entities ESLint errors blocking Next.js build**
- **Found during:** Task 2 build verification
- **Issue:** 4 pre-existing unescaped apostrophe errors in Phase 2 files (groups/[groupname]/page.tsx, users/[username]/page.tsx, users/[username]/auth-history/page.tsx) caused `next build` to fail
- **Fix:** Replaced raw `'` with `&apos;` in JSX text content of the 4 affected strings
- **Files modified:** frontend/src/app/(dashboard)/groups/[groupname]/page.tsx, frontend/src/app/(dashboard)/users/[username]/page.tsx, frontend/src/app/(dashboard)/users/[username]/auth-history/page.tsx
- **Verification:** `npx next build` completes successfully
- **Committed in:** b1a8eca (Task 2 commit)

**4. [Rule 2 - Missing Critical] Extracted shared format.ts utility**
- **Found during:** Task 3 (log pages) — saw formatDuration/formatBytes would be duplicated again
- **Issue:** Plan said "Import or re-implement formatDuration and formatBytes from sessions page" — re-implementing inline would create three copies across sessions page + two new log pages
- **Fix:** Created frontend/src/lib/format.ts with formatDuration, formatBytes, formatDate as shared exports
- **Files modified:** frontend/src/lib/format.ts (created)
- **Verification:** All log pages import from @/lib/format, no duplication
- **Committed in:** 4fa9a1a (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking-install, 1 bug, 1 blocking-eslint, 1 missing-critical)
**Impact on plan:** All auto-fixes necessary for correctness and build. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. Dashboard connects to the backend API endpoints built in Phase 03-01.

## Next Phase Readiness

- Observability layer is complete: dashboard + 3 log pages all wired to backend API contracts from 03-01
- Phase 04 (config-management) can proceed — no dependencies on observability layer
- Known: Recharts charts will show "Aucune donnée disponible" on a fresh install until RADIUS accounting data exists (expected behavior, not a stub)

---
*Phase: 03-observability*
*Completed: 2026-04-03*
